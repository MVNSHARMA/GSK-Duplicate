import express from 'express';
const app = express();
const router = express.Router();

router.post('/:id/cars/bulk', (req, res) => res.json({ msg: 'bulk' }));
router.patch('/:id/cars/:carId', (req, res) => res.json({ msg: 'patch carId' }));
router.post('/:id/cars/:carId/receive', (req, res) => res.json({ msg: 'receive' }));
router.post('/:id/cars/:carId/inspect', (req, res) => res.json({ msg: 'inspect' }));
router.post('/:id/cars/:carId/collect', (req, res) => res.json({ msg: 'collect' }));
router.post('/:id/cars/bulk-collect', (req, res) => res.json({ msg: 'bulk-collect' }));
router.post('/:id/cars/:carId/deliver', (req, res) => res.json({ msg: 'deliver' }));
router.post('/:id/cars/bulk-deliver', (req, res) => res.json({ msg: 'bulk-deliver' }));

app.use('/api/vehicle-batches', router);

const server = app.listen(0, async () => {
    const port = server.address().port;
    try {
        const res = await global.fetch(`http://localhost:${port}/api/vehicle-batches/123/cars/bulk-deliver`, { method: 'POST' });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch (e) {
        console.error(e);
    } finally {
        server.close();
    }
});
