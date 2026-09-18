const path = require('path');

// 1. Mock the repository layer before the service requires it
const repositories = require('../../../backend/src/repositories/ExpenseRepository');

let createdReceipts = [];
repositories.receiptRepo.findAll = async () => {
  return [
    // Normal receipt: "her" paid 100 for a shared expense
    // meaning "him" owes "her" 50.
    { _fireId: 'r1', type: 'receipt', payer: 'her', himCents: 5000, herCents: 5000, status: 'open', cycle: 'current' },
    
    // Settlement receipt: "him" already paid 20 to "her" as an advance via Pix
    // meaning "him" owes 20 less.
    { _fireId: 's1', type: 'settlement', payer: 'him', amountCents: 2000, cycle: 'current' }
  ];
};

repositories.receiptRepo.updateFields = async (id, fields) => {};
repositories.receiptRepo.create = async (data) => {
  createdReceipts.push(data);
};

// 2. Require the service
const ExpenseService = require('../../../backend/src/services/ExpenseService');

// 3. Execute the function
async function run() {
  console.log("=== RUNNING closeCycle ===");
  // "him" is paying another 30 now to close the cycle
  await ExpenseService.closeCycle({
    cycleName: '2026-09',
    payer: 'him',
    amountPaid: 3000,
    date: '2026-09-18',
    names: { him: 'Him', her: 'Her' }
  });

  console.log("\n=== RECEIPTS CREATED ===");
  createdReceipts.forEach(r => {
    if (r.type === 'rollover') {
      console.log(`Rollover Receipt created!`);
      console.log(`  himCents: ${r.himCents}`);
      console.log(`  herCents: ${r.herCents}`);
      console.log(`  splitType (who owes who): ${r.items[0].split}`);
      console.log(`  Total Rollover Cents: ${r.totalCents}`);
    }
  });

  // Expected logic:
  // "him" owes 5000 cents.
  // "him" already paid 2000 cents (settlement s1).
  // "him" pays 3000 cents now (amountPaid).
  // Total paid by him = 5000. Balance should be 0.
  // No rollover receipt should be created.
}

run().catch(console.error);
