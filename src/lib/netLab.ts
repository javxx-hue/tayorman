// A tiny office network for the "Kompyuter tarmoqlari" missions: PCs, one switch (SW1) and one router (R1) with
// VLAN subinterfaces, DHCP pools, static routes and the Internet behind it. Students type real commands
// (ipconfig, ping, show vlan brief, ip route ...) and the model answers like the real devices would.
// Reachability is decided by the configuration only, so a mission is checked by asking "does ping work now?".

export interface Addr {
  ip: string;
  mask: string;
  gw: string; // '' when none
  dns: string; // '' when none
}

export interface Pc {
  name: string;
  port: string; // switch access port
  dhcp: boolean;
  host: number; // the last part of the address DHCP hands out to this PC
  addr: Addr | null; // what ipconfig shows now (a DHCP lease is renewed only by ipconfig /renew)
}

export interface SubIf {
  name: string; // GigabitEthernet0/1.10
  vlan: number | null;
  ip: string | null;
  mask: string | null;
}

export interface Pool {
  name: string;
  network: string | null;
  mask: string | null;
  router: string | null;
  dns: string | null;
}

export interface Route {
  net: string;
  mask: string;
  via: string;
}

export interface Lab {
  pcs: Pc[];
  ports: Record<string, number>; // access port -> VLAN
  subs: SubIf[];
  routes: Route[];
  pools: Pool[];
}

type Mode = { kind: 'exec' } | { kind: 'config' } | { kind: 'if'; name: string } | { kind: 'pool'; name: string };

export interface Session {
  lab: Lab;
  modes: Record<string, Mode>;
}

export const SWITCH = 'SW1';
export const ROUTER = 'R1';
export const TRUNK_PORT = 'Fa0/1';
const WAN = { name: 'GigabitEthernet0/0', ip: '203.0.113.2', mask: '255.255.255.252' };
export const ISP = '203.0.113.1';
export const DNS_SERVER = '8.8.8.8';
const INTERNET_HOSTS = [DNS_SERVER, '203.0.113.50'];
const DNS_RECORDS: Record<string, string> = { 'tezyetkaz.uz': '203.0.113.50', 'www.tezyetkaz.uz': '203.0.113.50' };
const VLAN_NAMES: Record<number, string> = { 1: 'default', 10: 'BUXGALTERIYA', 20: 'OMBOR', 30: 'KURYERLAR' };
const SWITCH_PORTS = ['Fa0/1', 'Fa0/2', 'Fa0/3', 'Fa0/4', 'Fa0/5', 'Fa0/6', 'Fa0/7', 'Fa0/8'];

// ---------------------------------------------------------------- addresses
export function ipNum(ip: string | null | undefined): number | null {
  if (!ip) return null;
  const parts = ip.trim().split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return null;
  return parts.reduce((n, p) => n * 256 + Number(p), 0);
}

const ipStr = (n: number): string => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');

export function maskBits(mask: string | null | undefined): number | null {
  const n = ipNum(mask);
  if (n === null) return null;
  const bin = n.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(bin)) return null;
  const zero = bin.indexOf('0');
  return zero === -1 ? 32 : zero;
}

const netOf = (ip: number, bits: number): number => (bits === 0 ? 0 : Math.floor(ip / 2 ** (32 - bits)) * 2 ** (32 - bits));

export function sameNet(a: string, b: string, mask: string): boolean {
  const x = ipNum(a);
  const y = ipNum(b);
  const bits = maskBits(mask);
  return x !== null && y !== null && bits !== null && netOf(x, bits) === netOf(y, bits);
}

const isApipa = (a: Addr | null) => !a || a.ip.startsWith('169.254.');

// ---------------------------------------------------------------- the model
const vlanOf = (lab: Lab, pc: Pc) => lab.ports[pc.port] ?? 1;
const subFor = (lab: Lab, vlan: number) => lab.subs.find((s) => s.vlan === vlan && maskBits(s.mask) !== null && ipNum(s.ip) !== null);

// What a DHCP PC gets from R1 right now
export function leaseFor(lab: Lab, pc: Pc): Addr {
  const sub = subFor(lab, vlanOf(lab, pc));
  const pool = sub && lab.pools.find((p) => p.network && p.mask && sameNet(sub.ip!, p.network, p.mask));
  if (!sub || !pool) return { ip: `169.254.${(pc.host * 7) % 250}.${pc.host % 250}`, mask: '255.255.0.0', gw: '', dns: '' };
  const bits = maskBits(pool.mask)!;
  return { ip: ipStr(netOf(ipNum(pool.network)!, bits) + pc.host), mask: pool.mask!, gw: pool.router ?? '', dns: pool.dns ?? '' };
}

export function renewAll(lab: Lab): void {
  for (const pc of lab.pcs) if (pc.dhcp) pc.addr = leaseFor(lab, pc);
}

// The router answers for its own addresses in the VLAN; a PC answers when its address is right for the VLAN
function answers(lab: Lab, vlan: number, ip: string): boolean {
  if (lab.subs.some((s) => s.vlan === vlan && s.ip === ip)) return true;
  return lab.pcs.some((p) => vlanOf(lab, p) === vlan && p.addr?.ip === ip && !isApipa(p.addr));
}

// A PC can send beyond its subnet: its gateway is R1's address in its own VLAN
function gatewayOk(lab: Lab, pc: Pc): boolean {
  const a = pc.addr;
  if (!a || isApipa(a) || !a.gw || !sameNet(a.gw, a.ip, a.mask)) return false;
  return lab.subs.some((s) => s.vlan === vlanOf(lab, pc) && s.ip === a.gw && s.mask && sameNet(s.ip, a.ip, s.mask));
}

export type PingResult = 'ok' | 'noaddr' | 'timeout' | 'unreachable';

export function reach(lab: Lab, from: Pc, dst: string): PingResult {
  const a = from.addr;
  if (isApipa(a) || !a) return 'noaddr';
  if (ipNum(dst) === null) return 'timeout';
  const vlan = vlanOf(lab, from);
  if (sameNet(dst, a.ip, a.mask)) return answers(lab, vlan, dst) ? 'ok' : 'timeout';
  if (!gatewayOk(lab, from)) return 'timeout';
  // R1 has the packet
  if (dst === WAN.ip || lab.subs.some((s) => s.ip === dst)) return 'ok';
  const local = lab.subs.find((s) => s.vlan !== null && s.ip && s.mask && maskBits(s.mask) !== null && sameNet(dst, s.ip, s.mask));
  if (local) {
    const target = lab.pcs.find((p) => vlanOf(lab, p) === local.vlan && p.addr?.ip === dst);
    return target && gatewayOk(lab, target) ? 'ok' : 'timeout'; // the reply needs the target's gateway too
  }
  if (dst === ISP) return 'ok';
  const route = lab.routes
    .filter((r) => maskBits(r.mask) !== null && sameNet(dst, r.net, r.mask))
    .sort((x, y) => maskBits(y.mask)! - maskBits(x.mask)!)[0];
  if (!route) return 'unreachable';
  return (route.via === ISP || route.via === WAN.name) && INTERNET_HOSTS.includes(dst) ? 'ok' : 'timeout';
}

export function resolve(lab: Lab, from: Pc, name: string): string | null {
  const dns = from.addr?.dns;
  if (!dns || dns !== DNS_SERVER || reach(lab, from, dns) !== 'ok') return null;
  return DNS_RECORDS[name.toLowerCase()] ?? null;
}

// ---------------------------------------------------------------- the office
export function officeLab(): Lab {
  const lab: Lab = {
    pcs: [
      { name: 'PC-Aziza', port: 'Fa0/2', dhcp: true, host: 101, addr: null },
      { name: 'PC-Kassa', port: 'Fa0/3', dhcp: true, host: 102, addr: null },
      { name: 'Server', port: 'Fa0/4', dhcp: false, host: 10, addr: { ip: '192.168.10.10', mask: '255.255.255.0', gw: '192.168.10.1', dns: DNS_SERVER } },
      { name: 'PC-Ombor', port: 'Fa0/5', dhcp: true, host: 101, addr: null },
      { name: 'PC-Kuryer', port: 'Fa0/6', dhcp: false, host: 70, addr: { ip: '192.168.30.70', mask: '255.255.255.192', gw: '192.168.30.65', dns: DNS_SERVER } },
    ],
    ports: { 'Fa0/2': 10, 'Fa0/3': 10, 'Fa0/4': 10, 'Fa0/5': 20, 'Fa0/6': 30, 'Fa0/7': 1, 'Fa0/8': 1 },
    subs: [
      { name: 'GigabitEthernet0/1.10', vlan: 10, ip: '192.168.10.1', mask: '255.255.255.0' },
      { name: 'GigabitEthernet0/1.20', vlan: 20, ip: '192.168.20.1', mask: '255.255.255.0' },
      { name: 'GigabitEthernet0/1.30', vlan: 30, ip: '192.168.30.65', mask: '255.255.255.192' },
    ],
    routes: [{ net: '0.0.0.0', mask: '0.0.0.0', via: ISP }],
    pools: [
      { name: 'BUX', network: '192.168.10.0', mask: '255.255.255.0', router: '192.168.10.1', dns: DNS_SERVER },
      { name: 'OMBOR', network: '192.168.20.0', mask: '255.255.255.0', router: '192.168.20.1', dns: DNS_SERVER },
    ],
  };
  renewAll(lab);
  return lab;
}

export const pcNamed = (lab: Lab, name: string): Pc | undefined => lab.pcs.find((p) => p.name === name);
export const subNamed = (lab: Lab, name: string): SubIf | undefined => lab.subs.find((s) => s.name === name);

// ---------------------------------------------------------------- the consoles
export const newSession = (lab: Lab): Session => ({ lab, modes: {} });

export function prompt(s: Session, device: string): string {
  if (device !== SWITCH && device !== ROUTER) return `${device}>`;
  const m = s.modes[device] ?? { kind: 'exec' };
  return `${device}${m.kind === 'exec' ? '' : m.kind === 'config' ? '(config)' : m.kind === 'if' ? '(config-if)' : '(dhcp-config)'}#`;
}

const words = (line: string) => line.trim().split(/\s+/).filter(Boolean);
const lower = (line: string) => line.trim().toLowerCase().replace(/\s+/g, ' ');

export function runCommand(s: Session, device: string, line: string): string {
  let text = lower(line);
  if (!text) return '';
  if (text.startsWith('do ')) text = text.slice(3);
  if (device === SWITCH) return switchCommand(s, text, line);
  if (device === ROUTER) return routerCommand(s, text, line);
  const pc = pcNamed(s.lab, device);
  return pc ? pcCommand(s.lab, pc, text) : '';
}

// ---- PCs
const pad = (label: string) => ` ${label.padEnd(26, ' .').trimEnd()} : `;

function ipconfig(pc: Pc): string {
  const a = pc.addr;
  const lines = ['', 'Ethernet adapter Ethernet0:', ''];
  if (!a || isApipa(a)) {
    lines.push(`${pad('Autoconfiguration IPv4 Address')}${a?.ip ?? '0.0.0.0'}`, `${pad('Subnet Mask')}${a?.mask ?? '0.0.0.0'}`, `${pad('Default Gateway')}`, `${pad('DNS Servers')}`);
  } else {
    lines.push(`${pad('IPv4 Address')}${a.ip}`, `${pad('Subnet Mask')}${a.mask}`, `${pad('Default Gateway')}${a.gw}`, `${pad('DNS Servers')}${a.dns}`);
  }
  return lines.join('\n');
}

function pingText(lab: Lab, pc: Pc, target: string): string {
  let ip = target;
  let head = `Pinging ${target} with 32 bytes of data:`;
  if (ipNum(target) === null) {
    const found = resolve(lab, pc, target);
    if (!found) return `Ping request could not find host ${target}. Please check the name and try again.`;
    ip = found;
    head = `Pinging ${target} [${ip}] with 32 bytes of data:`;
  }
  const r = reach(lab, pc, ip);
  if (r === 'noaddr') return 'PING: transmit failed. General failure.';
  const line =
    r === 'ok' ? `Reply from ${ip}: bytes=32 ${ip.startsWith('192.168.') ? 'time<1ms TTL=128' : 'time=18ms TTL=117'}` : r === 'unreachable' ? `Reply from ${pc.addr!.gw}: Destination host unreachable.` : 'Request timed out.';
  const got = r === 'timeout' ? 0 : 4;
  return [head, '', line, line, line, line, '', `Ping statistics for ${ip}:`, `    Packets: Sent = 4, Received = ${got}, Lost = ${4 - got} (${(4 - got) * 25}% loss)`].join('\n');
}

function nslookup(lab: Lab, pc: Pc, name: string): string {
  const dns = pc.addr?.dns;
  if (!dns) return '*** Default servers are not available\nServer:  UnKnown\nAddress:  127.0.0.1';
  if (dns !== DNS_SERVER || reach(lab, pc, dns) !== 'ok') return `DNS request timed out.\n    timeout was 2 seconds.\nServer:  UnKnown\nAddress:  ${dns}\n\n*** Request to UnKnown timed-out`;
  const ip = DNS_RECORDS[name.toLowerCase()];
  const head = `Server:  dns.google\nAddress:  ${DNS_SERVER}\n\n`;
  return ip ? `${head}Non-authoritative answer:\nName:    ${name}\nAddress:  ${ip}` : `${head}*** dns.google can't find ${name}: Non-existent domain`;
}

function pcCommand(lab: Lab, pc: Pc, typed: string): string {
  // a phone keyboard often drops the space: "ipconfig/renew", "ipconfig -renew"
  const text = typed.replace(/^ipconfig\s*[/-]\s*(renew|release|all)$/, 'ipconfig /$1');
  const w = text.split(' ');
  if (w[0] === 'ipconfig') {
    if (w[1] === '/renew') {
      if (!pc.dhcp) return 'The operation failed as no adapter is in the state permissible for this operation.\n(Bu kompyuterning manzili qo\'lda berilgan, DHCP ishlatilmaydi.)';
      pc.addr = leaseFor(lab, pc);
      return ipconfig(pc);
    }
    if (w[1] === '/release') {
      if (pc.dhcp) pc.addr = { ip: '0.0.0.0', mask: '0.0.0.0', gw: '', dns: '' };
      return ipconfig(pc);
    }
    return ipconfig(pc);
  }
  if (w[0] === 'ping') return w[1] ? pingText(lab, pc, w[1]) : 'Manzil yozilmadi. Masalan: ping 8.8.8.8';
  if (w[0] === 'nslookup') return w[1] ? nslookup(lab, pc, w[1]) : 'Nom yozilmadi. Masalan: nslookup tezyetkaz.uz';
  return `'${w[0]}' is not recognized as an internal or external command.\n(Kompyuterda: ipconfig, ipconfig /renew, ping, nslookup)`;
}

// ---- switch and router: shared mode handling
const INVALID = "% Invalid input detected.\n(Buyruq tanilmadi. Yozilishini tekshiring.)";
const NEED_IF = "% Invalid input detected.\n(Bu buyruq interfeys ichida beriladi: avval interface ... yozing.)";

function modeCommand(s: Session, device: string, text: string): string | null {
  const m = s.modes[device] ?? { kind: 'exec' };
  if (text === 'enable' || text === 'en') return '';
  if (text === 'configure terminal' || text === 'conf t' || text === 'config t' || text === 'configure t') {
    s.modes[device] = { kind: 'config' };
    return 'Enter configuration commands, one per line.  End with CNTL/Z.';
  }
  if (text === 'end') {
    s.modes[device] = { kind: 'exec' };
    return '';
  }
  if (text === 'exit') {
    s.modes[device] = m.kind === 'if' || m.kind === 'pool' ? { kind: 'config' } : { kind: 'exec' };
    return '';
  }
  // saving the configuration, as students are taught to do at the end
  if (['wr', 'write', 'write memory', 'wr mem', 'copy running-config startup-config', 'copy run start'].includes(text))
    return 'Building configuration...\n[OK]';
  return null;
}

function normPort(raw: string): string | null {
  const m = raw.match(/^(?:fa|fastethernet|f)(\d\/\d+)$/i);
  return m ? `Fa${m[1]}` : null;
}

function normSub(raw: string): string | null {
  const m = raw.match(/^(?:g|gi|gig|gigabitethernet)(\d\/\d+(?:\.\d+)?)$/i);
  return m ? `GigabitEthernet${m[1]}` : null;
}

// ---- SW1
function showVlan(lab: Lab): string {
  const vlans = new Set<number>([1, 10, 20, 30, ...Object.values(lab.ports)]);
  const rows = [...vlans]
    .sort((a, b) => a - b)
    .map((v) => {
      const ports = SWITCH_PORTS.filter((p) => p !== TRUNK_PORT && (lab.ports[p] ?? 1) === v).join(', ');
      return `${String(v).padEnd(5)}${(VLAN_NAMES[v] ?? `VLAN${String(v).padStart(4, '0')}`).padEnd(14)}active  ${ports}`;
    });
  return ['VLAN Name          Status  Ports', '---- ------------- ------- ------------------', ...rows].join('\n');
}

function switchRun(lab: Lab): string {
  const out = ['hostname SW1', '!', `interface ${TRUNK_PORT}`, ' switchport mode trunk', '!'];
  for (const p of SWITCH_PORTS.filter((x) => x !== TRUNK_PORT)) {
    out.push(`interface ${p}`, ' switchport mode access');
    if ((lab.ports[p] ?? 1) !== 1) out.push(` switchport access vlan ${lab.ports[p]}`);
    out.push('!');
  }
  return out.join('\n');
}

function switchCommand(s: Session, text: string, raw: string): string {
  const lab = s.lab;
  const mode = modeCommand(s, SWITCH, text);
  if (mode !== null) return mode;
  if (text === 'show vlan brief' || text === 'show vlan' || text === 'sh vlan br' || text === 'sh vlan brief') return showVlan(lab);
  if (text === 'show running-config' || text === 'show run' || text === 'sh run') return switchRun(lab);
  const w = words(raw.replace(/^do\s+/i, ''));
  if (/^int(erface)?$/i.test(w[0] ?? '')) {
    const port = normPort((w[1] ?? '') + (w[2] ?? ''));
    if (!port || !SWITCH_PORTS.includes(port)) return `% Invalid interface. SW1 portlari: ${SWITCH_PORTS.join(', ')}`;
    s.modes[SWITCH] = { kind: 'if', name: port };
    return '';
  }
  const m = s.modes[SWITCH];
  if (text === 'switchport mode access') return m?.kind === 'if' ? '' : NEED_IF;
  const vlan = text.match(/^switchport access vlan (\d+)$/);
  if (vlan) {
    if (m?.kind !== 'if') return NEED_IF;
    if (m.name === TRUNK_PORT) return "% Fa0/1 trunk port (routerga ulangan), uni o'zgartirmang.";
    const n = Number(vlan[1]);
    if (n < 1 || n > 4094) return '% Bad VLAN list';
    lab.ports[m.name] = n;
    return '';
  }
  if (text === 'no shutdown' || text === 'no shut') return m?.kind === 'if' ? '' : NEED_IF;
  return INVALID;
}

// ---- R1
const prefix = (ip: string, mask: string) => `${ip}/${maskBits(mask)}`;

function showRoute(lab: Lab): string {
  const def = lab.routes.find((r) => r.mask === '0.0.0.0');
  const out = [
    'Codes: C - connected, S - static, * - candidate default',
    '',
    def ? `Gateway of last resort is ${def.via} to network 0.0.0.0` : 'Gateway of last resort is not set',
    '',
    `C    ${prefix('203.0.113.0', WAN.mask)} is directly connected, ${WAN.name}`,
  ];
  for (const sub of lab.subs) {
    const bits = maskBits(sub.mask);
    const ip = ipNum(sub.ip);
    if (bits !== null && ip !== null && sub.vlan !== null) out.push(`C    ${ipStr(netOf(ip, bits))}/${bits} is directly connected, ${sub.name}`);
  }
  for (const r of lab.routes)
    out.push(`${r.mask === '0.0.0.0' ? 'S*' : 'S '}   ${prefix(r.net, r.mask)} ${ipNum(r.via) === null ? `is directly connected, ${r.via}` : `[1/0] via ${r.via}`}`);
  return out.join('\n');
}

function showIpBrief(lab: Lab): string {
  const rows = [[WAN.name, WAN.ip], ['GigabitEthernet0/1', 'unassigned'], ...lab.subs.map((x) => [x.name, x.ip ?? 'unassigned'])];
  return ['Interface              IP-Address      Status', ...rows.map(([n, ip]) => `${n.padEnd(23)}${ip.padEnd(16)}up`)].join('\n');
}

function routerRun(lab: Lab): string {
  const out = ['hostname R1', '!'];
  for (const p of lab.pools) {
    out.push(`ip dhcp pool ${p.name}`);
    if (p.network) out.push(` network ${p.network} ${p.mask}`);
    if (p.router) out.push(` default-router ${p.router}`);
    if (p.dns) out.push(` dns-server ${p.dns}`);
    out.push('!');
  }
  out.push(`interface ${WAN.name}`, ` ip address ${WAN.ip} ${WAN.mask}`, ' ip nat outside', '!', 'interface GigabitEthernet0/1', ' no ip address', '!');
  for (const x of lab.subs) {
    out.push(`interface ${x.name}`);
    if (x.vlan !== null) out.push(` encapsulation dot1Q ${x.vlan}`);
    out.push(x.ip ? ` ip address ${x.ip} ${x.mask}` : ' no ip address', ' ip nat inside', '!');
  }
  out.push('ip nat inside source list 1 interface GigabitEthernet0/0 overload');
  for (const r of lab.routes) out.push(`ip route ${r.net} ${r.mask} ${r.via}`);
  return out.join('\n');
}

function showPools(lab: Lab): string {
  return lab.pools
    .map((p) => [`Pool ${p.name} :`, ` Network            : ${p.network ?? '-'} ${p.mask ?? ''}`, ` Default router     : ${p.router ?? '-'}`, ` DNS server         : ${p.dns ?? '-'}`].join('\n'))
    .join('\n\n');
}

const BAD_IP = '% Invalid address. (Manzil 4 ta 0–255 sondan iborat bo\'ladi, masalan 192.168.10.1)';
const BAD_MASK = "% Bad mask. (Maska noto'g'ri, masalan 255.255.255.0)";

// R1 pings from itself: its own addresses, hosts in its VLANs, the provider, and the Internet through a route
function routerPing(lab: Lab, dst: string): string {
  if (ipNum(dst) === null) return '% Unrecognized host or address.';
  let r: 'ok' | 'timeout' | 'unreachable';
  if (dst === WAN.ip || dst === ISP || lab.subs.some((x) => x.ip === dst)) r = 'ok';
  else {
    const local = lab.subs.find((x) => x.vlan !== null && x.ip && maskBits(x.mask) !== null && sameNet(dst, x.ip, x.mask!));
    if (local) r = answers(lab, local.vlan!, dst) ? 'ok' : 'timeout';
    else {
      const route = lab.routes.find((x) => maskBits(x.mask) !== null && sameNet(dst, x.net, x.mask));
      r = !route ? 'unreachable' : (route.via === ISP || route.via === WAN.name) && INTERNET_HOSTS.includes(dst) ? 'ok' : 'timeout';
    }
  }
  const marks = r === 'ok' ? '!!!!!' : r === 'unreachable' ? 'U.U.U' : '.....';
  const got = r === 'ok' ? 5 : 0;
  return [
    'Type escape sequence to abort.',
    `Sending 5, 100-byte ICMP Echos to ${dst}, timeout is 2 seconds:`,
    marks,
    `Success rate is ${got * 20} percent (${got}/5)`,
  ].join('\n');
}

function routerCommand(s: Session, text: string, raw: string): string {
  const lab = s.lab;
  const mode = modeCommand(s, ROUTER, text);
  if (mode !== null) return mode;
  if (text === 'show ip route' || text === 'sh ip route' || text === 'sh ip ro') return showRoute(lab);
  if (text === 'show ip interface brief' || text === 'sh ip int br' || text === 'sh ip int brief') return showIpBrief(lab);
  if (text === 'show running-config' || text === 'show run' || text === 'sh run') return routerRun(lab);
  if (text === 'show ip dhcp pool' || text === 'sh ip dhcp pool') return showPools(lab);
  const w = words(raw.replace(/^do\s+/i, ''));
  const m = s.modes[ROUTER];

  if (/^int(erface)?$/i.test(w[0] ?? '')) {
    const name = normSub((w[1] ?? '') + (w[2] ?? ''));
    if (!name) return '% Invalid interface. Masalan: interface GigabitEthernet0/1.30';
    if (name === WAN.name) return "% G0/0 provayderga ulangan, uni o'zgartirmang.";
    if (!/\.\d+$/.test(name)) return "% Bu missiyada faqat G0/1 ning VLAN subinterfeyslari sozlanadi (masalan G0/1.30).";
    if (!subNamed(lab, name)) lab.subs.push({ name, vlan: null, ip: null, mask: null });
    s.modes[ROUTER] = { kind: 'if', name };
    return '';
  }
  const enc = text.match(/^encapsulation dot1q (\d+)$/);
  if (enc) {
    if (m?.kind !== 'if') return NEED_IF;
    subNamed(lab, m.name)!.vlan = Number(enc[1]);
    return '';
  }
  const addr = text.match(/^ip address (\S+) (\S+)$/);
  if (addr) {
    if (m?.kind !== 'if') return NEED_IF;
    if (ipNum(addr[1]) === null) return BAD_IP;
    if (maskBits(addr[2]) === null) return BAD_MASK;
    const sub = subNamed(lab, m.name)!;
    sub.ip = addr[1];
    sub.mask = addr[2];
    return '';
  }
  if (text === 'no shutdown' || text === 'no shut') return m?.kind === 'if' ? '' : NEED_IF;

  const route = text.match(/^(no )?ip route (\S+) (\S+) (\S+)$/);
  if (route) {
    const [, no, net, mask, rawVia] = route;
    // The next hop is an address, or the exit interface towards the provider
    const via = ipNum(rawVia) !== null ? rawVia : normSub(rawVia);
    if (ipNum(net) === null || !via) return BAD_IP;
    if (maskBits(mask) === null) return BAD_MASK;
    lab.routes = lab.routes.filter((r) => !(r.net === net && r.mask === mask));
    if (!no) lab.routes.push({ net, mask, via });
    return '';
  }
  const pool = raw.trim().match(/^ip dhcp pool (\S+)$/i);
  if (pool) {
    const name = pool[1].toUpperCase();
    // a real router would quietly create an empty pool; here a typo should be noticed
    if (!lab.pools.some((p) => p.name === name)) return `% Bunday DHCP pool yo'q. R1 dagi pullar: ${lab.pools.map((p) => p.name).join(', ')}`;
    s.modes[ROUTER] = { kind: 'pool', name };
    return '';
  }
  const ping = text.match(/^ping (\S+)$/);
  if (ping) return routerPing(lab, ping[1]);
  const inPool = m?.kind === 'pool' ? lab.pools.find((p) => p.name === m.name) : undefined;
  const one = text.match(/^(default-router|dns-server) (\S+)$/);
  if (one) {
    if (!inPool) return '% Invalid input detected.\n(Bu buyruq DHCP pool ichida beriladi: avval ip dhcp pool NOMI yozing.)';
    if (ipNum(one[2]) === null) return BAD_IP;
    if (one[1] === 'default-router') inPool.router = one[2];
    else inPool.dns = one[2];
    return '';
  }
  const net = text.match(/^network (\S+) (\S+)$/);
  if (net) {
    if (!inPool) return '% Invalid input detected.\n(Bu buyruq DHCP pool ichida beriladi.)';
    if (ipNum(net[1]) === null) return BAD_IP;
    if (maskBits(net[2]) === null) return BAD_MASK;
    inPool.network = net[1];
    inPool.mask = net[2];
    return '';
  }
  return INVALID;
}
