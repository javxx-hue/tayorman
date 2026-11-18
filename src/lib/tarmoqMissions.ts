// "Kompyuter tarmoqlari" story: the student joins the network team of the same made-up company and fixes five
// real-looking faults in the office network with real commands. Each mission starts from the correct office with
// its own fault and the faults of the later missions in place (the earlier ones are already fixed).
import { Lab, officeLab, pcNamed, reach, renewAll, resolve, ROUTER, subNamed, SWITCH } from './netLab';

export const NET_BOSS = 'Bobur';

export interface NetMission {
  id: number;
  title: string;
  brief: string[];
  task: string;
  devices: string[]; // consoles the student can open, the first one opens first
  chips: Record<string, string[]>; // command pieces per device
  hint: string;
  solution: string[]; // "DEVICE: command" lines
  success: string[];
  questions: string[];
  goal: (lab: Lab) => { ok: boolean; note?: string };
}

const pingOk = (lab: Lab, pc: string, ip: string) => {
  const p = pcNamed(lab, pc);
  return !!p && reach(lab, p, ip) === 'ok';
};

// Faults by the mission that fixes them
const FAULTS: Record<number, (lab: Lab) => void> = {
  1: (lab) => {
    lab.ports['Fa0/3'] = 1; // the cashier's port was left in the default VLAN
  },
  2: (lab) => {
    lab.pools.find((p) => p.name === 'OMBOR')!.router = '192.168.20.254';
  },
  3: (lab) => {
    lab.routes = [];
  },
  4: (lab) => {
    lab.pools.find((p) => p.name === 'BUX')!.dns = '192.168.10.53';
  },
  5: (lab) => {
    lab.subs = lab.subs.filter((s) => s.vlan !== 30);
  },
};

export function missionLab(id: number): Lab {
  const lab = officeLab();
  for (const [n, fault] of Object.entries(FAULTS)) if (Number(n) >= id) fault(lab);
  renewAll(lab);
  return lab;
}

const PC_CHIPS = ['ipconfig', 'ipconfig /renew', 'ping', 'nslookup'];
const CONF = ['configure terminal', 'exit', 'end'];

export const TARMOQ_MISSIONS: NetMission[] = [
  {
    id: 1,
    title: 'Kassa jim',
    brief: [
      "Salom! Men Bobur, tarmoq administratoriman. Bugun mening yordamchimsiz.",
      "Kassadagi kompyuter ertalabdan internetga ham, serverga ham ulanmayapti. Kassir chek chiqara olmayapti!",
      'Avval kompyuterning o\'zida ipconfig ni ko\'ring.',
    ],
    task: "PC-Kassa 192.168.10.x manzilini olishi kerak. Sababini toping: kompyuter qaysi portga ulangan va u qaysi VLAN'da? Kassa buxgalteriya VLAN 10 da bo'lishi kerak. Tuzatgach, kompyuterda ipconfig /renew bering.",
    devices: ['PC-Kassa', SWITCH],
    chips: {
      'PC-Kassa': PC_CHIPS,
      [SWITCH]: ['show vlan brief', ...CONF, 'interface Fa0/3', 'switchport mode access', 'switchport access vlan', '10'],
    },
    hint: "169.254.x.x manzili «DHCP serverdan javob kelmadi» degani. SW1 da show vlan brief: Fa0/3 qaysi VLAN'da turibdi? Tuzatish: interface Fa0/3 → switchport access vlan 10. Keyin PC-Kassa da ipconfig /renew.",
    solution: ['SW1: configure terminal', 'SW1: interface Fa0/3', 'SW1: switchport access vlan 10', 'SW1: end', 'PC-Kassa: ipconfig /renew'],
    success: [
      "Kassa ishladi! Port standart VLAN 1 da qolib ketgan ekan, u yerda DHCP server yo'q.",
      "Shuning uchun kompyuter o'ziga 169.254... manzilini olgan edi. Endi omborxonadan ham shikoyat bor...",
    ],
    questions: ['q-tarmoq-028', 'q-tarmoq-029', 'q-tarmoq-166', 'q-tarmoq-168', 'q-tarmoq-171'],
    goal: (lab) => ({ ok: !!pcNamed(lab, 'PC-Kassa')?.addr?.ip.startsWith('192.168.10.') }),
  },
  {
    id: 2,
    title: 'Ombor serverni ko\'rmayapti',
    brief: [
      "Omborxona kompyuterining manzili bor, o'z bo'limidagilar bilan ishlayapti.",
      "Lekin buxgalteriya serveriga (192.168.10.10) ulana olmayapti. Boshqa VLAN'ga paketni router o'tkazadi.",
    ],
    task: "PC-Ombor dan ping 192.168.10.10 ishlashi kerak. Kompyuterning shlyuzini (Default Gateway) tekshiring, uni DHCP beradi. R1 dagi OMBOR pulini tuzating va kompyuterda manzilni yangilang.",
    devices: ['PC-Ombor', ROUTER],
    chips: {
      'PC-Ombor': [...PC_CHIPS, '192.168.10.10', '192.168.20.1'],
      [ROUTER]: ['show ip dhcp pool', 'show running-config', ...CONF, 'ip dhcp pool OMBOR', 'default-router', '192.168.20.1'],
    },
    hint: "ipconfig da Default Gateway 192.168.20.254, lekin routerning VLAN 20 dagi manzili 192.168.20.1. R1 da: ip dhcp pool OMBOR → default-router 192.168.20.1. Keyin PC-Ombor da ipconfig /renew.",
    solution: ['R1: configure terminal', 'R1: ip dhcp pool OMBOR', 'R1: default-router 192.168.20.1', 'R1: end', 'PC-Ombor: ipconfig /renew', 'PC-Ombor: ping 192.168.10.10'],
    success: [
      "Ombor serverga ulandi! DHCP noto'g'ri shlyuz tarqatayotgan ekan: kompyuter paketni yo'q manzilga yuborgan.",
      "O'z tarmog'idagilar bilan ishlagani ham shundan: ular uchun shlyuz kerak emas.",
    ],
    questions: ['q-tarmoq-037', 'q-tarmoq-058', 'q-tarmoq-142', 'q-tarmoq-178', 'q-tarmoq-179', 'q-tarmoq-144'],
    goal: (lab) => ({ ok: pingOk(lab, 'PC-Ombor', '192.168.10.10') }),
  },
  {
    id: 3,
    title: 'Butun ofis internetsiz',
    brief: [
      "Yomon xabar: tunda routerni yangilashdi, endi hech kim internetga chiqa olmayapti.",
      "Ichki tarmoq ishlayapti. Muammo routerning tashqariga yo'lida bo'lsa kerak.",
    ],
    task: "PC-Aziza dan ping 8.8.8.8 ishlashi kerak. R1 ning marshrut jadvalini ko'ring. Provayder shlyuzi: 203.0.113.1. Routerga standart marshrut (default route) qo'shing.",
    devices: ['PC-Aziza', ROUTER],
    chips: {
      'PC-Aziza': [...PC_CHIPS, '8.8.8.8'],
      [ROUTER]: ['show ip route', ...CONF, 'ip route', '0.0.0.0 0.0.0.0', '203.0.113.1'],
    },
    hint: "show ip route da «Gateway of last resort is not set»: router bilmagan manzillarni qayerga yuborishni bilmaydi. Tuzatish: ip route 0.0.0.0 0.0.0.0 203.0.113.1",
    solution: ['R1: configure terminal', 'R1: ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'R1: end', 'PC-Aziza: ping 8.8.8.8'],
    success: [
      "Internet qaytdi! Yangilashda standart marshrut o'chib ketgan ekan.",
      "Lekin Aziza opa «sayt baribir ochilmayapti» deyapti. Qiziq...",
    ],
    questions: ['q-tarmoq-041', 'q-tarmoq-045', 'q-tarmoq-172', 'q-tarmoq-173', 'q-tarmoq-170'],
    goal: (lab) => ({ ok: pingOk(lab, 'PC-Aziza', '8.8.8.8') }),
  },
  {
    id: 4,
    title: 'Ping bor, sayt yo\'q',
    brief: [
      "ping 8.8.8.8 ishlayapti, demak internet bor. Lekin tezyetkaz.uz sayti ochilmayapti.",
      "Raqam bilan ishlaydi, nom bilan ishlamaydi... Nomni manzilga kim aylantiradi?",
    ],
    task: "PC-Aziza da ping tezyetkaz.uz ishlashi kerak. nslookup bilan tekshiring va kompyuterning DNS serverini ko'ring. To'g'ri DNS server: 8.8.8.8. R1 dagi BUX pulini tuzating va manzilni yangilang.",
    devices: ['PC-Aziza', ROUTER],
    chips: {
      'PC-Aziza': [...PC_CHIPS, 'tezyetkaz.uz'],
      [ROUTER]: ['show ip dhcp pool', ...CONF, 'ip dhcp pool BUX', 'dns-server', '8.8.8.8'],
    },
    hint: "ipconfig da DNS Servers 192.168.10.53, bunday server yo'q. R1 da: ip dhcp pool BUX → dns-server 8.8.8.8. Keyin PC-Aziza da ipconfig /renew va ping tezyetkaz.uz.",
    solution: ['R1: configure terminal', 'R1: ip dhcp pool BUX', 'R1: dns-server 8.8.8.8', 'R1: end', 'PC-Aziza: ipconfig /renew', 'PC-Aziza: ping tezyetkaz.uz'],
    success: [
      "Sayt ochildi! DHCP kompyuterlarga mavjud bo'lmagan DNS server manzilini berayotgan ekan.",
      "Rahbariyat xursand. Endi kattaroq ish bor: yangi bo'lim ochilyapti.",
    ],
    questions: ['q-tarmoq-057', 'q-tarmoq-181', 'q-tarmoq-143', 'q-tarmoq-183'],
    goal: (lab) => {
      const pc = pcNamed(lab, 'PC-Aziza');
      const ip = pc && resolve(lab, pc, 'tezyetkaz.uz');
      return { ok: !!pc && !!ip && reach(lab, pc, ip) === 'ok' };
    },
  },
  {
    id: 5,
    title: 'Yangi bo\'lim',
    brief: [
      "Kompaniya kuryerlar bo'limini ochdi: 50 ta qurilma, ular uchun VLAN 30.",
      "Men 192.168.30.0/24 tarmog'ini 4 ta teng /26 subnetga bo'ldim. Kuryerlarga 2-subnet tegdi.",
      "Kuryerning kompyuteri allaqachon ulangan, routerni siz sozlaysiz. Hisoblashni o'zingiz qilasiz!",
    ],
    task: "R1 da GigabitEthernet0/1.30 subinterfeysini yarating: VLAN 30 (encapsulation dot1Q 30), manzili 2-subnetning birinchi ishlatiladigan manzili, maskasi /26. Shunda PC-Kuryer dan ping 8.8.8.8 ishlaydi.",
    devices: [ROUTER, 'PC-Kuryer'],
    chips: {
      [ROUTER]: ['show ip interface brief', ...CONF, 'interface GigabitEthernet0/1.30', 'encapsulation dot1Q 30', 'ip address', '255.255.255.192', '255.255.255.0'],
      'PC-Kuryer': ['ipconfig', 'ping', '8.8.8.8'],
    },
    hint: "/26 da har subnetda 64 ta manzil: 0–63, 64–127, 128–191, 192–255. 2-subnet 192.168.30.64 dan boshlanadi, birinchi ishlatiladigan manzil undan keyingisi. /26 maskasi: 255.255.255.192.",
    solution: ['R1: configure terminal', 'R1: interface GigabitEthernet0/1.30', 'R1: encapsulation dot1Q 30', 'R1: ip address 192.168.30.65 255.255.255.192', 'R1: end', 'PC-Kuryer: ping 8.8.8.8'],
    success: [
      "Kuryerlar bo'limi internetga chiqdi! Subnetni to'g'ri hisobladingiz: 192.168.30.65/26.",
      "Bugun 5 ta nosozlikni topdingiz va tuzatdingiz. Siz endi haqiqiy tarmoqchisiz!",
    ],
    questions: ['q-tarmoq-033', 'q-tarmoq-035', 'q-tarmoq-036', 'q-tarmoq-040', 'q-tarmoq-127', 'q-tarmoq-169'],
    goal: (lab) => {
      const sub = lab.subs.find((s) => s.vlan === 30);
      const ping = pingOk(lab, 'PC-Kuryer', '8.8.8.8');
      if (!ping) return { ok: false };
      if (sub?.mask !== '255.255.255.192' || sub.ip !== '192.168.30.65' || !subNamed(lab, 'GigabitEthernet0/1.30'))
        return { ok: false, note: "Ping ishladi, lekin manzil yoki maska topshiriqdagidek emas: kerakli subnet /26 (255.255.255.192), manzil esa 2-subnetning birinchi ishlatiladigan manzili." };
      return { ok: true };
    },
  },
];
