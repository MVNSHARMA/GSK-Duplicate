import { deriveTrackerStatusAndCounts } from './src/controllers/vehicleBatchController.js';

const scenarios = [
  { name: '1. All Expected', cars: [{ status: 'Expected' }, { status: 'Expected' }] },
  { name: '2. All Received', cars: [{ status: 'Received' }, { status: 'Received' }] },
  { name: '3. Received + Inspection', cars: [{ status: 'Received' }, { status: 'Inspection' }] },
  { name: '4. In Service + Waiting for Approval', cars: [{ status: 'In Service' }, { status: 'Waiting for Approval' }] },
  { name: '5. In Service + Waiting for Parts', cars: [{ status: 'In Service' }, { status: 'Waiting for Parts' }] },
  { name: '6. Waiting for Approval + Waiting for Parts', cars: [{ status: 'Waiting for Approval' }, { status: 'Waiting for Parts' }] },
  { name: '7. Ready + In Service', cars: [{ status: 'Ready for Collection' }, { status: 'In Service' }] },
  { name: '8. Ready + Waiting for Parts', cars: [{ status: 'Ready for Collection' }, { status: 'Waiting for Parts' }] },
  { name: '9. Collected + In Service', cars: [{ status: 'Collected' }, { status: 'In Service' }] },
  { name: '10. Collected + Ready', cars: [{ status: 'Collected' }, { status: 'Ready for Collection' }] },
  { name: '11. All applicable Ready', cars: [{ status: 'Ready for Collection' }, { status: 'Ready for Collection' }, { status: 'Cancelled' }] },
  { name: '12. All applicable Collected', cars: [{ status: 'Collected' }, { status: 'Collected' }, { status: 'Cancelled' }] },
  { name: '13. Collected + Cancelled', cars: [{ status: 'Collected' }, { status: 'Cancelled' }] },
];

console.log('--- RUNNING TEST MATRIX ---');

for (const scenario of scenarios) {
  const memberships = scenario.cars.map(c => ({ status: c.status, isActive: true }));
  const result = deriveTrackerStatusAndCounts(memberships, 'RENTAL');
  console.log(`Scenario: ${scenario.name}`);
  console.log(`  Derived Status: ${result.overallStatus}`);
}
console.log('--- TEST MATRIX COMPLETE ---');
process.exit(0);
