const test=require('node:test');
const assert=require('node:assert/strict');
const {periodBounds,rowsToPayload}=require('../../utils/dashboardHppTopping');

test('periodBounds handles December rollover',()=>{
  assert.deepEqual(periodBounds('2026-12'),{start:'2026-12-01',nextMonth:'2027-01-01'});
  assert.throws(()=>periodBounds('2026-13'),/YYYY-MM/);
});

test('rowsToPayload marks missing prices incomplete and rounds rupiah',()=>{
  const payload=rowsToPayload('2026-09',[{outlet_name:'UGM',amount:'1200.4',transaction_count:'3',missing_cost_count:'1'}],'2026-09-08T00:00:00Z');
  assert.deepEqual(payload.outlets.UGM,{amount:1200,transactionCount:3,missingCostCount:1,complete:false});
});

test('rowsToPayload marks fully priced outlet complete',()=>{
  const payload=rowsToPayload('2026-09',[{outlet_name:'Pogung',amount:'2500',transaction_count:'2',missing_cost_count:'0'}]);
  assert.equal(payload.outlets.Pogung.complete,true);
});
