// QA fixture: stage a realistic multi-day sales spread for Reports QA (Task 41)
// Items/hours/methods varied; 1 cancelled; 1 unpaid. All rows tagged notes='rpt-fixture' for cleanup.
import pg from 'pg';

const client = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.gehjsxopcowmotgrrcgc',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const TID = 'd207be19-e86f-4780-befb-3968831a38fe';
const LOC = '5dd11592-2c9e-4bcf-b589-585d3270ab16';

// [dayOffset, istHour, type, status, pay_status, method, customer, [[name, variant, qty, unit]]]
const TICKETS = [
  [0, 9, 'dine_in', 'completed', 'completed', 'upi', 'Meera', [['Flat White', 'Large', 2, 270], ['Masala Toast', null, 1, 160]]],
  [0, 10, 'takeaway', 'completed', 'completed', 'cash', 'Arjun', [['Cappuccino', null, 1, 220], ['Flat White', null, 1, 220]]],
  [0, 12, 'dine_in', 'completed', 'completed', 'upi', 'Sana', [['Cold Brew', null, 2, 240], ['Veg Grilled Sandwich', null, 1, 190]]],
  [0, 16, 'dine_in', 'ready', 'pending', null, 'Dev', [['Flat White', 'Large', 1, 270], ['Cappuccino', null, 2, 440]]],
  [0, 18, 'takeaway', 'completed', 'completed', 'card', 'Isha', [['Cold Brew', null, 1, 240]]],
  [1, 9, 'dine_in', 'completed', 'completed', 'upi', 'Riya', [['Flat White', null, 1, 220], ['Masala Toast', null, 2, 320]]],
  [1, 11, 'dine_in', 'cancelled', 'pending', null, 'Kabir', [['Cappuccino', null, 1, 220]]],
  [1, 13, 'dine_in', 'completed', 'completed', 'cash', 'Tara', [['Veg Grilled Sandwich', null, 2, 380], ['Cold Brew', null, 1, 240]]],
  [1, 17, 'delivery', 'completed', 'completed', 'upi', 'Nikhil', [['Flat White', 'Large', 3, 810]]],
  [2, 10, 'takeaway', 'completed', 'completed', 'upi', 'Aditi', [['Cappuccino', null, 2, 440], ['Masala Toast', null, 1, 160]]],
  [2, 15, 'dine_in', 'completed', 'completed', 'card', 'Rohan', [['Cold Brew', null, 2, 480]]],
  [3, 9, 'dine_in', 'completed', 'completed', 'upi', 'Zoya', [['Flat White', null, 2, 440]]],
];

const GST = 0.05;

await client.connect();
let n = 0;
for (const [dayOff, istH, type, status, payStatus, method, cust, lines] of TICKETS) {
  // IST hour -> UTC instant, dayOff = days AGO (0 = today)
  const istDate = new Date(Date.now() - dayOff * 24 * 3600 * 1000);
  const istIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(istDate);
  const created = new Date(`${istIso}T${String(istH).padStart(2, '0')}:15:00+05:30`);
  const sub = lines.reduce((s, [, , qty, unit]) => s + qty * unit, 0);
  const tax = Math.round(sub * GST * 100) / 100;
  const total = Math.round((sub + tax) * 100) / 100;
  const ord = await client.query(
    `INSERT INTO orders (tenant_id, location_id, order_type, status, customer_name, subtotal, tax_amount, total, payment_status, payment_method, notes, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'rpt-fixture',$11) RETURNING id, order_number`,
    [TID, LOC, type, status, cust, sub, tax, total, payStatus, method, created.toISOString()]
  );
  const oid = ord.rows[0].id;
  for (const [name, variant, qty, unit] of lines) {
    await client.query(
      `INSERT INTO order_items (tenant_id, order_id, name, variant_name, qty, unit_price, item_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [TID, oid, name, variant, qty, unit, qty * unit]
    );
  }
  n += 1;
  console.log(`#${ord.rows[0].order_number} ${status}/${payStatus ?? '-'} ${type} ${cust} ₹${total} @IST ${istH}h +${dayOff}d`);
}
console.log('STAGED', n, 'tickets');
await client.end();
