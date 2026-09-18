const path = require('path');
const repositories = require('../../../backend/src/repositories/ExpenseRepository');

let createdReceipts = [];
repositories.receiptRepo.findAll = async () => {
  return [
    // A receipt from "him" containing a third-party debt
    { 
      _fireId: 'r1', type: 'receipt', payer: 'him', status: 'open', cycle: 'current',
      items: [
        { name: 'Dinner', priceCents: 10000, split: 'other', otherName: 'John' }
      ],
      himCents: 0, herCents: 0, otherCents: 10000 
    }
  ];
};

repositories.receiptRepo.updateFields = async (id, fields) => {};
repositories.receiptRepo.create = async (data) => {
  createdReceipts.push(data);
};

const ExpenseService = require('../../../backend/src/services/ExpenseService');

async function run() {
  console.log("=== RUNNING closeCycle ===");
  await ExpenseService.closeCycle({
    cycleName: '2026-09',
    payer: 'him',
    amountPaid: 0,
    date: '2026-09-18',
    names: { him: 'Him', her: 'Her' }
  });

  console.log("\n=== RECEIPTS CREATED ===");
  createdReceipts.forEach(r => console.log(r));
}

run().catch(console.error);
