const PERIOD_PATTERN=/^20\d{2}-(0[1-9]|1[0-2])$/;

function periodBounds(period){
  if(!PERIOD_PATTERN.test(period||''))throw new Error('Periode harus berformat YYYY-MM.');
  const [year,month]=period.split('-').map(Number);
  return {start:`${period}-01`,nextMonth:month===12?`${year+1}-01-01`:`${year}-${String(month+1).padStart(2,'0')}-01`};
}

function rowsToPayload(period,rows,generatedAt=new Date().toISOString()){
  const outlets={};
  for(const row of rows){
    const missingCostCount=Number(row.missing_cost_count||0);
    const transactionCount=Number(row.transaction_count||0);
    outlets[row.outlet_name]={amount:Math.round(Number(row.amount||0)),transactionCount,missingCostCount,complete:transactionCount>0&&missingCostCount===0};
  }
  return {version:1,period,generatedAt,outlets};
}

module.exports={periodBounds,rowsToPayload};
