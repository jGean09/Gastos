class Expense {
  constructor({ id, desc, cat, amt, method, parcelas, date, payer, split, image, month }) {
    this.id = id;
    this.desc = desc;
    this.cat = cat;
    this.amt = parseFloat(amt);
    this.method = method;
    this.parcelas = parseInt(parcelas) || 1;
    this.date = date;
    this.payer = payer; // 'him' or 'her'
    this.split = split; // true or false
    this.image = image || null;
    this.month = month; // e.g., '2023-10'
  }
}

module.exports = Expense;
