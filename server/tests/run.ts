import { runAllTests } from './suite.js';

console.log('====================================================');
console.log(' Running Planisware CAPEX Maintenance Test Suite...');
console.log('====================================================\n');

const results = runAllTests();
let passedCount = 0;

results.forEach((r) => {
  if (r.passed) {
    passedCount++;
    console.log(`✅ [PASS] ${r.title}`);
    console.log(`   ${r.message}`);
  } else {
    console.log(`❌ [FAIL] ${r.title}`);
    console.log(`   ${r.message}`);
  }
});

console.log('\n====================================================');
console.log(` Test Results: ${passedCount} / ${results.length} Passed`);
console.log('====================================================');

if (passedCount < results.length) {
  process.exit(1);
} else {
  process.exit(0);
}
