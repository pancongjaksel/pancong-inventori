require('dotenv').config();
const {buildDashboardHppTopping}=require('../services/dashboardHppToppingService');
const {pool}=require('../db/pool');

function currentJakartaPeriod(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const values=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return `${values.year}-${values.month}`;
}

async function main(){
  const args=process.argv.slice(2);
  const period=args.find(arg=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(arg))||currentJakartaPeriod();
  const send=args.includes('--send');
  const payload=await buildDashboardHppTopping(period);
  if(!send){console.log(JSON.stringify(payload,null,2));return;}
  const dashboardUrl=(process.env.DASHBOARD_URL||'').replace(/\/$/,'');
  const syncPin=process.env.HERMES_SYNC_PIN;
  if(!dashboardUrl||!syncPin)throw new Error('DASHBOARD_URL dan HERMES_SYNC_PIN wajib diisi untuk --send.');
  const response=await fetch(`${dashboardUrl}/api/inventory-costs`,{method:'POST',headers:{'content-type':'application/json','x-hermes-sync-pin':syncPin},body:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||`Dashboard HTTP ${response.status}`);
  console.log(JSON.stringify({ok:true,period,outlets:Object.keys(payload.outlets).length,result},null,2));
}

main().catch(error=>{console.error(error.message||error);process.exitCode=1;}).finally(()=>pool.end());
