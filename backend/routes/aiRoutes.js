const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/predict', async (req, res) => {
    try {
        const { original_price, age, condition, category } = req.body;

        const response = await axios.post(`${process.env.AI_SERVICE_URL}/predict`, {
            original_price: parseFloat(original_price),
            age: parseInt(age),
            condition: parseInt(condition),
            category: category
        });

        res.json({ success: true, predicted_price: response.data.predicted_price });
    } catch (error) {
        console.error('AI prediction error:', error);
        res.status(500).json({ success: false, message: 'Price prediction failed' });
    }
});

module.exports = router;
