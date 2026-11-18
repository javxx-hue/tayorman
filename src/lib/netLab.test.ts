import { describe, expect, it } from 'vitest';
import { ipNum, maskBits, newSession, officeLab, pcNamed, prompt, reach, ROUTER, runCommand, sameNet, Session, SWITCH } from './netLab';
import { missionLab, TARMOQ_MISSIONS } from './tarmoqMissions';

const session = (id: number): Session => newSession(missionLab(id));
const run = (s: Session, device: string, ...lines: string[]) => lines.map((l) => runCommand(s, device, l)).join('\n');
const solve = (s: Session, lines: string[]) => {
  for (const l of lines) {
    const [device, cmd] = l.split(/:\s(.+)/);
    runCommand(s, device, cmd);
  }
};
const goal = (s: Session, id: number) => TARMOQ_MISSIONS.find((m) => m.id === id)!.goal(s.lab);

describe('addresses', () => {
  it('parses addresses and masks', () => {
    expect(ipNum('192.168.10.1')).toBe(3232238081);
    expect(ipNum('256.1.1.1')).toBeNull();
    expect(ipNum('1.2.3')).toBeNull();
    expect(maskBits('255.255.255.192')).toBe(26);
    expect(maskBits('0.0.0.0')).toBe(0);
    expect(maskBits('255.0.255.0')).toBeNull();
    expect(sameNet('192.168.30.70', '192.168.30.65', '255.255.255.192')).toBe(true);
    expect(sameNet('192.168.30.130', '192.168.30.65', '255.255.255.192')).toBe(false);
  });
});

describe('the healthy office', () => {
  it('reaches everything from every PC', () => {
    const lab = officeLab();
    for (const pc of lab.pcs) {
      expect(reach(lab, pc, '8.8.8.8'), pc.name).toBe('ok');
      expect(reach(lab, pc, '192.168.10.10'), pc.name).toBe('ok');
    }
  });
});

describe('every mission', () => {
  it('starts broken and is fixed by its solution', () => {
    expect(TARMOQ_MISSIONS.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
    for (const m of TARMOQ_MISSIONS) {
      const s = session(m.id);
      expect(m.goal(s.lab).ok, `${m.title} before`).toBe(false);
      solve(s, m.solution);
      expect(m.goal(s.lab).ok, `${m.title} after`).toBe(true);
      expect(m.questions.every((q) => /^q-tarmoq-\d{3}$/.test(q))).toBe(true);
      expect(m.devices.every((d) => m.chips[d])).toBe(true);
    }
  });
});

describe('mission 1: wrong VLAN', () => {
  it('shows the self-assigned address and the port in VLAN 1', () => {
    const s = session(1);
    expect(run(s, 'PC-Kassa', 'ipconfig')).toMatch(/Autoconfiguration IPv4 Address.*169\.254\./);
    expect(run(s, 'PC-Kassa', 'ping 192.168.10.1')).toMatch(/General failure/);
    expect(run(s, SWITCH, 'show vlan brief')).toMatch(/^1\s+default\s+active\s+Fa0\/3/m);
  });
  it('needs the renew after the switch fix, and the interface first', () => {
    const s = session(1);
    expect(run(s, SWITCH, 'switchport access vlan 10')).toMatch(/interfeys ichida/);
    run(s, SWITCH, 'conf t', 'int fa0/3', 'switchport access vlan 10', 'end');
    expect(prompt(s, SWITCH)).toBe('SW1#');
    expect(goal(s, 1).ok).toBe(false);
    run(s, 'PC-Kassa', 'ipconfig /renew');
    expect(goal(s, 1).ok).toBe(true);
    expect(run(s, 'PC-Kassa', 'ipconfig')).toMatch(/IPv4 Address.*192\.168\.10\.102/);
  });
  it('a wrong VLAN does not help', () => {
    const s = session(1);
    run(s, SWITCH, 'interface Fa0/3', 'switchport access vlan 20');
    run(s, 'PC-Kassa', 'ipconfig /renew');
    expect(goal(s, 1).ok).toBe(false);
  });
});

describe('mission 2: wrong gateway from DHCP', () => {
  it('works inside its subnet but not beyond', () => {
    const s = session(2);
    expect(run(s, 'PC-Ombor', 'ipconfig')).toMatch(/Default Gateway.*192\.168\.20\.254/);
    expect(run(s, 'PC-Ombor', 'ping 192.168.20.1')).toMatch(/Received = 4/);
    expect(run(s, 'PC-Ombor', 'ping 192.168.10.10')).toMatch(/Request timed out/);
    expect(run(s, ROUTER, 'show ip dhcp pool')).toMatch(/Default router\s+: 192\.168\.20\.254/);
  });
  it('the pool commands need the pool first', () => {
    const s = session(2);
    expect(run(s, ROUTER, 'default-router 192.168.20.1')).toMatch(/DHCP pool ichida/);
    expect(prompt(s, ROUTER)).toBe('R1#');
    run(s, ROUTER, 'conf t', 'ip dhcp pool ombor');
    expect(prompt(s, ROUTER)).toBe('R1(dhcp-config)#');
  });
});

describe('mission 3: no default route', () => {
  it('says the gateway of last resort is not set', () => {
    const s = session(3);
    expect(run(s, ROUTER, 'show ip route')).toMatch(/Gateway of last resort is not set/);
    expect(run(s, 'PC-Aziza', 'ping 8.8.8.8')).toMatch(/Destination host unreachable/);
  });
  it('accepts the exit interface form and refuses a bad mask', () => {
    const s = session(3);
    expect(run(s, ROUTER, 'ip route 0.0.0.0 255.0.255.0 203.0.113.1')).toMatch(/Bad mask/);
    run(s, ROUTER, 'ip route 0.0.0.0 0.0.0.0 g0/0');
    expect(goal(s, 3).ok).toBe(true);
    expect(run(s, ROUTER, 'show ip route')).toMatch(/S\*\s+0\.0\.0\.0\/0 is directly connected, GigabitEthernet0\/0/);
  });
  it('a route to the wrong next hop does not help', () => {
    const s = session(3);
    run(s, ROUTER, 'ip route 0.0.0.0 0.0.0.0 192.168.10.1');
    expect(goal(s, 3).ok).toBe(false);
  });
});

describe('mission 4: wrong DNS server', () => {
  it('pings by number but not by name', () => {
    const s = session(4);
    expect(run(s, 'PC-Aziza', 'ping 8.8.8.8')).toMatch(/Received = 4/);
    expect(run(s, 'PC-Aziza', 'ping tezyetkaz.uz')).toMatch(/could not find host/);
    expect(run(s, 'PC-Aziza', 'nslookup tezyetkaz.uz')).toMatch(/timed out/);
  });
  it('resolves after the fix and the renew', () => {
    const s = session(4);
    solve(s, ['R1: ip dhcp pool BUX', 'R1: dns-server 8.8.8.8', 'R1: exit']);
    expect(goal(s, 4).ok).toBe(false);
    run(s, 'PC-Aziza', 'ipconfig /renew');
    expect(run(s, 'PC-Aziza', 'nslookup tezyetkaz.uz')).toMatch(/Address:\s+203\.0\.113\.50/);
    expect(run(s, 'PC-Aziza', 'nslookup yoq.uz')).toMatch(/Non-existent domain/);
    expect(goal(s, 4).ok).toBe(true);
  });
});

describe('mission 5: the /26 subnet', () => {
  it('wants the exact address and mask', () => {
    const s = session(5);
    run(s, ROUTER, 'interface g0/1.30', 'encapsulation dot1Q 30', 'ip address 192.168.30.65 255.255.255.0');
    expect(goal(s, 5)).toMatchObject({ ok: false, note: expect.stringMatching(/maska/) });
    run(s, ROUTER, 'ip address 192.168.30.65 255.255.255.192');
    expect(goal(s, 5).ok).toBe(true);
  });
  it('the first subnet or a missing VLAN tag fails', () => {
    const s = session(5);
    run(s, ROUTER, 'interface g0/1.30', 'ip address 192.168.30.65 255.255.255.192');
    expect(goal(s, 5).ok).toBe(false); // no encapsulation yet
    const t = session(5);
    run(t, ROUTER, 'interface g0/1.30', 'encapsulation dot1Q 30', 'ip address 192.168.30.1 255.255.255.192');
    expect(goal(t, 5).ok).toBe(false);
  });
  it('protects the provider link and refuses bad input', () => {
    const s = session(5);
    expect(run(s, ROUTER, 'interface g0/0')).toMatch(/provayder/);
    expect(run(s, ROUTER, 'interface g0/1.30', 'ip address 192.168.300.65 255.255.255.192')).toMatch(/Invalid address/);
    expect(run(s, ROUTER, 'blah')).toMatch(/Invalid input/);
    expect(run(s, 'PC-Kuryer', 'ipconfig /renew')).toMatch(/qo'lda berilgan/);
    expect(run(s, 'PC-Kuryer', 'dir')).toMatch(/not recognized/);
    expect(pcNamed(s.lab, 'PC-Kuryer')?.addr?.ip).toBe('192.168.30.70');
  });
});
