const express = require('express');
const router = express.Router();

const {
    getWebsiteSEOAnalysis,
    getPageSpeedInsights,
    getCombinedSEOData,
    getDetailedOnPageSEO
} = require('../controllers/seo');

// Route for Website Analyze and SEO Audit (PRO)
router.get('/analyze', getWebsiteSEOAnalysis);

// Route for PageSpeed Insights
router.get('/pagespeed', getPageSpeedInsights);

// Route for combined SEO data (both APIs)
router.get('/combined', getCombinedSEOData);

// Route for detailed on-page SEO analysis
router.get('/onpage', getDetailedOnPageSEO);

module.exports = router;
