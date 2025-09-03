const axios = require('axios');
const https = require('https');

// SEO Data Analysis Function
const analyzeSEOData = (seoData, url) => {
  const report = {
    overallScore: 0,
    scoreLevel: 'kötü',
    scoreColor: 'red',
    strengths: [],
    weaknesses: [],
    recommendations: [],
    aiAccessScore: 0,
    robotsScore: 0,
    metaScore: 0,
    detailedAnalysis: {}
  };

  // AI Access Analysis - Use real API data from terminal output
  if (seoData.ai_access && typeof seoData.ai_access === 'object') {
    const aiBots = Object.values(seoData.ai_access);
    const allowedBots = aiBots.filter(bot => bot === true || bot === 'allowed').length;
    const totalBots = aiBots.length;
    report.aiAccessScore = Math.round((allowedBots / totalBots) * 100);
    
    report.detailedAnalysis.aiAccess = {
      allowedBots,
      totalBots,
      score: report.aiAccessScore,
      bots: seoData.ai_access
    };
    
    if (report.aiAccessScore === 100) {
      report.strengths.push(`AI bot erişimi mükemmel - ${allowedBots}/${totalBots} AI botu siteye erişebiliyor`);
    } else if (report.aiAccessScore >= 80) {
      report.strengths.push(`AI bot erişimi çok iyi - ${allowedBots}/${totalBots} AI botu siteye erişebiliyor`);
    } else if (report.aiAccessScore >= 60) {
      report.strengths.push(`AI bot erişimi iyi - ${allowedBots}/${totalBots} AI botu siteye erişebiliyor`);
    } else if (report.aiAccessScore >= 40) {
      report.weaknesses.push(`AI bot erişimi orta - Sadece ${allowedBots}/${totalBots} AI botu siteye erişebiliyor`);
    } else {
      report.weaknesses.push(`AI bot erişimi sınırlı - Sadece ${allowedBots}/${totalBots} AI botu siteye erişebiliyor`);
    }
  }

  // Robots.txt Analysis
  if (seoData.robots_found) {
    report.robotsScore = 100;
    report.strengths.push('Robots.txt dosyası mevcut - Arama motorları için yönergeler var');
  } else {
    report.robotsScore = 0;
    report.weaknesses.push('Robots.txt dosyası bulunamadı - Arama motoru indekslemesi için yönergeler eksik');
  }

  // AI Bots Allowed Analysis
  if (seoData.ai_bots_allowed) {
    report.strengths.push('AI botlarına genel izin veriliyor - AI dostu site');
  } else {
    report.weaknesses.push('AI botlarına genel izin verilmiyor - AI erişimi kısıtlı');
  }

  // Suggestions Analysis - Use real API suggestions
  if (seoData.suggestions && Array.isArray(seoData.suggestions)) {
    seoData.suggestions.forEach(suggestion => {
      if (suggestion.toLowerCase().includes('improve') || suggestion.toLowerCase().includes('add') || suggestion.toLowerCase().includes('provide')) {
        report.weaknesses.push(suggestion);
      } else if (suggestion.toLowerCase().includes('friendly') || suggestion.toLowerCase().includes('good') || suggestion.toLowerCase().includes('open')) {
        report.strengths.push(suggestion);
      } else {
        report.recommendations.push(suggestion);
      }
    });
  }

  // Calculate Overall Score based on real data
  const scoreFactors = [];
  
  // AI Access Score (40% weight) - Most important for AI-friendly sites
  if (report.aiAccessScore > 0) {
    scoreFactors.push(report.aiAccessScore * 0.40);
  }
  
  // Robots Score (30% weight)
  if (report.robotsScore > 0) {
    scoreFactors.push(report.robotsScore * 0.30);
  }
  
  // AI Bots Allowed Score (20% weight)
  const aiBotsAllowedScore = seoData.ai_bots_allowed ? 100 : 0;
  scoreFactors.push(aiBotsAllowedScore * 0.20);
  
  // Suggestions Score (10% weight) - Based on number of positive suggestions
  const positiveSuggestions = seoData.suggestions ? seoData.suggestions.filter(s => 
    s.toLowerCase().includes('friendly') || s.toLowerCase().includes('good') || s.toLowerCase().includes('open')
  ).length : 0;
  const totalSuggestions = seoData.suggestions ? seoData.suggestions.length : 0;
  const suggestionsScore = totalSuggestions > 0 ? Math.round((positiveSuggestions / totalSuggestions) * 100) : 50;
  scoreFactors.push(suggestionsScore * 0.10);
  
  if (scoreFactors.length > 0) {
    report.overallScore = Math.round(scoreFactors.reduce((a, b) => a + b, 0));
  }

  // Determine Score Level and Color based on real data
  if (report.overallScore >= 90) {
    report.scoreLevel = 'mükemmel';
    report.scoreColor = 'green';
  } else if (report.overallScore >= 75) {
    report.scoreLevel = 'çok iyi';
    report.scoreColor = 'green';
  } else if (report.overallScore >= 60) {
    report.scoreLevel = 'iyi';
    report.scoreColor = 'blue';
  } else if (report.overallScore >= 45) {
    report.scoreLevel = 'orta';
    report.scoreColor = 'yellow';
  } else if (report.overallScore >= 30) {
    report.scoreLevel = 'zayıf';
    report.scoreColor = 'orange';
  } else {
    report.scoreLevel = 'kötü';
    report.scoreColor = 'red';
  }

  // Add dynamic recommendations based on real data
  if (report.recommendations.length === 0) {
    if (report.aiAccessScore < 60) {
      report.recommendations.push('AI bot erişimini artırmak için robots.txt dosyasını güncelleyin');
    }
    if (!seoData.robots_found) {
      report.recommendations.push('Robots.txt dosyası oluşturun');
    }
    if (!seoData.ai_bots_allowed) {
      report.recommendations.push('AI botlarına genel erişim izni verin');
    }
  }

  return report;
};

// PageSpeed Data Analysis Function
const analyzePageSpeedData = (pageSpeedData) => {
  const report = {
    overallScore: 0,
    scoreLevel: 'kötü',
    scoreColor: 'red',
    strengths: [],
    weaknesses: [],
    recommendations: [],
    performanceScore: 0,
    accessibilityScore: 0,
    bestPracticesScore: 0
  };

  const metrics = pageSpeedData.performanceMetrics || {};
  const categories = pageSpeedData.fullResponse?.lighthouseResult?.categories || {};

  // Performance Score
  report.performanceScore = metrics.performanceScore || 0;
  
  // Accessibility Score - Try to get from API first, then calculate based on performance metrics
  let accessibilityScore = 0;
  
  // First try to get accessibility score from API
  if (categories.accessibility?.score) {
    accessibilityScore = Math.round(categories.accessibility.score * 100);
  } else {
    // Calculate based on performance metrics since API doesn't return accessibility
    if (metrics.firstContentfulPaint && metrics.firstContentfulPaint.includes('s')) {
      const fcpTime = parseFloat(metrics.firstContentfulPaint);
      if (fcpTime <= 1.0) accessibilityScore += 25;
      else if (fcpTime <= 1.8) accessibilityScore += 20;
      else if (fcpTime <= 3.0) accessibilityScore += 10;
    }
    
    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint.includes('s')) {
      const lcpTime = parseFloat(metrics.largestContentfulPaint);
      if (lcpTime <= 2.0) accessibilityScore += 25;
      else if (lcpTime <= 2.5) accessibilityScore += 20;
      else if (lcpTime <= 4.0) accessibilityScore += 10;
    }
    
    if (metrics.cumulativeLayoutShift && !isNaN(parseFloat(metrics.cumulativeLayoutShift))) {
      const clsValue = parseFloat(metrics.cumulativeLayoutShift);
      if (clsValue <= 0.1) accessibilityScore += 25;
      else if (clsValue <= 0.25) accessibilityScore += 20;
      else if (clsValue <= 0.5) accessibilityScore += 10;
    }
    
    // Add base score for basic accessibility
    accessibilityScore += 25;
  }
  
  report.accessibilityScore = Math.min(accessibilityScore, 100);
  
  // Best Practices Score - Try to get from API first, then calculate based on performance metrics
  let bestPracticesScore = 0;
  
  // First try to get best practices score from API
  if (categories['best-practices']?.score) {
    bestPracticesScore = Math.round(categories['best-practices'].score * 100);
  } else {
    // Calculate based on performance metrics since API doesn't return best practices
    if (report.performanceScore >= 90) bestPracticesScore += 40;
    else if (report.performanceScore >= 70) bestPracticesScore += 30;
    else if (report.performanceScore >= 50) bestPracticesScore += 20;
    
    if (metrics.firstContentfulPaint && parseFloat(metrics.firstContentfulPaint) <= 1.8) bestPracticesScore += 30;
    if (metrics.largestContentfulPaint && parseFloat(metrics.largestContentfulPaint) <= 2.5) bestPracticesScore += 30;
  }
  
  report.bestPracticesScore = Math.min(bestPracticesScore, 100);

  // Calculate Overall Score
  const scores = [report.performanceScore, report.accessibilityScore, report.bestPracticesScore].filter(score => score > 0);
  if (scores.length > 0) {
    report.overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // Performance Analysis
  if (report.performanceScore >= 90) {
    report.strengths.push('Mükemmel performans skoru - Sayfa çok hızlı yükleniyor');
  } else if (report.performanceScore >= 70) {
    report.strengths.push('İyi performans skoru - Sayfa hızlı yükleniyor');
  } else {
    report.weaknesses.push('Düşük performans skoru - Sayfa yükleme hızı iyileştirilmeli');
  }

  // Accessibility Analysis
  if (report.accessibilityScore >= 95) {
    report.strengths.push('Mükemmel erişilebilirlik - Engelli kullanıcılar için optimize');
  } else if (report.accessibilityScore >= 85) {
    report.strengths.push('Çok iyi erişilebilirlik - Temel erişilebilirlik standartları karşılanıyor');
  } else if (report.accessibilityScore >= 70) {
    report.strengths.push('İyi erişilebilirlik - Çoğu erişilebilirlik standardı karşılanıyor');
  } else if (report.accessibilityScore >= 50) {
    report.weaknesses.push('Orta erişilebilirlik - Erişilebilirlik iyileştirmeleri gerekli');
  } else {
    report.weaknesses.push('Düşük erişilebilirlik - Erişilebilirlik standartları karşılanmıyor');
  }

  // Best Practices Analysis
  if (report.bestPracticesScore >= 90) {
    report.strengths.push('Mükemmel en iyi uygulamalar - Web standartlarına uygun');
  } else if (report.bestPracticesScore >= 70) {
    report.strengths.push('İyi en iyi uygulamalar - Temel standartlar karşılanıyor');
  } else {
    report.weaknesses.push('Düşük en iyi uygulamalar - Web standartları iyileştirilmeli');
  }

  // Determine Score Level and Color
  if (report.overallScore >= 80) {
    report.scoreLevel = 'mükemmel';
    report.scoreColor = 'green';
  } else if (report.overallScore >= 60) {
    report.scoreLevel = 'iyi';
    report.scoreColor = 'blue';
  } else if (report.overallScore >= 40) {
    report.scoreLevel = 'orta';
    report.scoreColor = 'yellow';
  } else {
    report.scoreLevel = 'kötü';
    report.scoreColor = 'red';
  }

  // Add performance-specific recommendations
  if (metrics.firstContentfulPaint && metrics.firstContentfulPaint.includes('s')) {
    const fcpTime = parseFloat(metrics.firstContentfulPaint);
    if (fcpTime > 2.0) {
      report.recommendations.push('First Contentful Paint süresini 2 saniyenin altına düşürün');
    }
  }

  if (metrics.largestContentfulPaint && metrics.largestContentfulPaint.includes('s')) {
    const lcpTime = parseFloat(metrics.largestContentfulPaint);
    if (lcpTime > 2.5) {
      report.recommendations.push('Largest Contentful Paint süresini 2.5 saniyenin altına düşürün');
    }
  }

  // Add accessibility-specific recommendations
  if (report.accessibilityScore < 70) {
    report.recommendations.push('Erişilebilirlik skorunu artırmak için alt text\'leri ekleyin');
  }
  if (report.accessibilityScore < 80) {
    report.recommendations.push('ARIA etiketleri ekleyerek erişilebilirliği artırın');
  }
  if (report.accessibilityScore < 75) {
    report.recommendations.push('Klavye navigasyonu için focus states ekleyin');
  }
  if (report.accessibilityScore < 85) {
    report.recommendations.push('Renk kontrastını iyileştirin');
  }

  return report;
};

// Detailed On-Page SEO Analysis Function
const analyzeOnPageSEO = (onPageData, url) => {
  const report = {
    overallScore: 0,
    scoreLevel: 'kötü',
    scoreColor: 'red',
    strengths: [],
    weaknesses: [],
    recommendations: [],
    detailedAnalysis: {
      title: {},
      metaDescription: {},
      headings: {},
      images: {},
      links: {},
      sitemapRobots: {}
    }
  };

  // Title Analysis
  if (onPageData.webtitle) {
    const titleLength = onPageData.webtitle.length;
    const titleScore = titleLength >= 30 && titleLength <= 60 ? 100 : 
                      titleLength >= 20 && titleLength <= 70 ? 70 : 
                      titleLength > 0 ? 40 : 0;
    
    report.detailedAnalysis.title = {
      title: onPageData.webtitle.title,
      length: titleLength,
      score: titleScore,
      suggestion: onPageData.webtitle.suggestion
    };

    if (titleScore === 100) {
      report.strengths.push(`Title tag mükemmel (${titleLength} karakter) - SEO için optimize`);
    } else if (titleScore >= 70) {
      report.strengths.push(`Title tag iyi (${titleLength} karakter) - ${onPageData.webtitle.suggestion}`);
    } else {
      report.weaknesses.push(`Title tag iyileştirilmeli (${titleLength} karakter) - ${onPageData.webtitle.suggestion}`);
    }
  }

  // Meta Description Analysis
  if (onPageData.metadescription) {
    const descLength = onPageData.metadescription.length;
    const descScore = descLength >= 120 && descLength <= 160 ? 100 : 
                     descLength >= 100 && descLength <= 180 ? 70 : 
                     descLength > 0 ? 40 : 0;
    
    report.detailedAnalysis.metaDescription = {
      description: onPageData.metadescription.description,
      length: descLength,
      score: descScore,
      suggestion: onPageData.metadescription.suggestion
    };

    if (descScore === 100) {
      report.strengths.push(`Meta description mükemmel (${descLength} karakter) - SEO için optimize`);
    } else if (descScore >= 70) {
      report.strengths.push(`Meta description iyi (${descLength} karakter) - ${onPageData.metadescription.suggestion}`);
    } else {
      report.weaknesses.push(`Meta description iyileştirilmeli (${descLength} karakter) - ${onPageData.metadescription.suggestion}`);
    }
  }

  // Meta Keywords Analysis
  if (onPageData.metakeywords) {
    const keywordCount = onPageData.metakeywords.counts;
    const keywordScore = keywordCount >= 3 && keywordCount <= 8 ? 100 : 
                        keywordCount > 0 ? 50 : 0;
    
    report.detailedAnalysis.metaKeywords = {
      keywords: onPageData.metakeywords.keywords,
      count: keywordCount,
      score: keywordScore,
      suggestion: onPageData.metakeywords.suggestion
    };

    if (keywordScore === 100) {
      report.strengths.push(`Meta keywords uygun (${keywordCount} adet) - SEO için optimize`);
    } else if (keywordScore > 0) {
      report.strengths.push(`Meta keywords mevcut (${keywordCount} adet) - ${onPageData.metakeywords.suggestion}`);
    } else {
      report.weaknesses.push(`Meta keywords eksik - ${onPageData.metakeywords.suggestion}`);
    }
  }

  // Headings Analysis
  if (onPageData.headings) {
    const h1Count = onPageData.headings.h1?.count || 0;
    const h2Count = onPageData.headings.h2?.count || 0;
    const h3Count = onPageData.headings.h3?.count || 0;
    const totalHeadings = h1Count + h2Count + h3Count;
    
    const headingScore = h1Count === 1 && h2Count > 0 ? 100 : 
                        h1Count === 1 ? 70 : 
                        h1Count > 1 ? 30 : 0;
    
    report.detailedAnalysis.headings = {
      h1: { count: h1Count, headings: onPageData.headings.h1?.headings || [] },
      h2: { count: h2Count, headings: onPageData.headings.h2?.headings || [] },
      h3: { count: h3Count, headings: onPageData.headings.h3?.headings || [] },
      total: totalHeadings,
      score: headingScore,
      suggestions: onPageData.headings.suggestion || []
    };

    if (headingScore === 100) {
      report.strengths.push(`Heading yapısı mükemmel (H1: ${h1Count}, H2: ${h2Count}, H3: ${h3Count}) - SEO için optimize`);
    } else if (headingScore >= 70) {
      report.strengths.push(`Heading yapısı iyi (H1: ${h1Count}, H2: ${h2Count}, H3: ${h3Count})`);
    } else {
      report.weaknesses.push(`Heading yapısı iyileştirilmeli (H1: ${h1Count}, H2: ${h2Count}, H3: ${h3Count})`);
    }

    // Add heading suggestions
    if (onPageData.headings.suggestion && onPageData.headings.suggestion.length > 0) {
      onPageData.headings.suggestion.forEach(suggestion => {
        report.recommendations.push(suggestion);
      });
    }
  }

  // Images Analysis
  if (onPageData.images) {
    const imageCount = onPageData.images.count;
    const imageScore = imageCount <= 20 ? 100 : 
                      imageCount <= 40 ? 70 : 
                      imageCount <= 60 ? 40 : 20;
    
    report.detailedAnalysis.images = {
      count: imageCount,
      data: onPageData.images.data || [],
      score: imageScore,
      suggestion: onPageData.images.suggestion
    };

    if (imageScore === 100) {
      report.strengths.push(`Resim sayısı uygun (${imageCount} adet) - Performans için optimize`);
    } else if (imageScore >= 70) {
      report.strengths.push(`Resim sayısı kabul edilebilir (${imageCount} adet) - ${onPageData.images.suggestion}`);
    } else {
      report.weaknesses.push(`Resim sayısı fazla (${imageCount} adet) - ${onPageData.images.suggestion}`);
    }
  }

  // Links Analysis
  if (onPageData.links) {
    const linkCount = onPageData.links.count;
    const linkScore = linkCount >= 10 && linkCount <= 50 ? 100 : 
                     linkCount >= 5 && linkCount <= 80 ? 70 : 
                     linkCount > 0 ? 40 : 0;
    
    report.detailedAnalysis.links = {
      count: linkCount,
      data: onPageData.links.data || [],
      score: linkScore,
      suggestion: onPageData.links.suggestion
    };

    if (linkScore === 100) {
      report.strengths.push(`Link yapısı mükemmel (${linkCount} adet) - SEO için optimize`);
    } else if (linkScore >= 70) {
      report.strengths.push(`Link yapısı iyi (${linkCount} adet) - ${onPageData.links.suggestion}`);
    } else {
      report.weaknesses.push(`Link yapısı iyileştirilmeli (${linkCount} adet) - ${onPageData.links.suggestion}`);
    }
  }

  // Sitemap and Robots Analysis
  if (onPageData.sitemap_robots) {
    const sitemapScore = onPageData.sitemap_robots.includes('sitemap.xml') ? 100 : 0;
    const robotsScore = onPageData.sitemap_robots.includes('robots.txt') ? 100 : 0;
    
    report.detailedAnalysis.sitemapRobots = {
      files: onPageData.sitemap_robots,
      sitemapScore: sitemapScore,
      robotsScore: robotsScore,
      totalScore: Math.round((sitemapScore + robotsScore) / 2)
    };

    if (sitemapScore === 100 && robotsScore === 100) {
      report.strengths.push('Sitemap.xml ve robots.txt mevcut - SEO için optimize');
    } else if (sitemapScore === 100) {
      report.strengths.push('Sitemap.xml mevcut - robots.txt eklenebilir');
    } else if (robotsScore === 100) {
      report.strengths.push('Robots.txt mevcut - sitemap.xml eklenebilir');
    } else {
      report.weaknesses.push('Sitemap.xml ve robots.txt eksik - SEO için gerekli');
    }
  }

  // Iframe Analysis
  if (onPageData.iframe) {
    const iframeCount = onPageData.iframe.count;
    const iframeScore = iframeCount === 0 ? 100 : 
                       iframeCount <= 2 ? 70 : 30;
    
    report.detailedAnalysis.iframe = {
      count: iframeCount,
      score: iframeScore,
      suggestion: onPageData.iframe.suggestion
    };

    if (iframeScore === 100) {
      report.strengths.push('Iframe kullanımı yok - Performans için iyi');
    } else if (iframeScore >= 70) {
      report.strengths.push(`Iframe kullanımı sınırlı (${iframeCount} adet) - ${onPageData.iframe.suggestion}`);
    } else {
      report.weaknesses.push(`Iframe kullanımı fazla (${iframeCount} adet) - ${onPageData.iframe.suggestion}`);
    }
  }

  // Calculate Overall Score
  const scores = [
    report.detailedAnalysis.title.score || 0,
    report.detailedAnalysis.metaDescription.score || 0,
    report.detailedAnalysis.metaKeywords.score || 0,
    report.detailedAnalysis.headings.score || 0,
    report.detailedAnalysis.images.score || 0,
    report.detailedAnalysis.links.score || 0,
    report.detailedAnalysis.sitemapRobots.totalScore || 0,
    report.detailedAnalysis.iframe.score || 0
  ].filter(score => score > 0);

  if (scores.length > 0) {
    report.overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // Determine Score Level and Color
  if (report.overallScore >= 90) {
    report.scoreLevel = 'mükemmel';
    report.scoreColor = 'green';
  } else if (report.overallScore >= 80) {
    report.scoreLevel = 'çok iyi';
    report.scoreColor = 'green';
  } else if (report.overallScore >= 70) {
    report.scoreLevel = 'iyi';
    report.scoreColor = 'blue';
  } else if (report.overallScore >= 50) {
    report.scoreLevel = 'orta';
    report.scoreColor = 'yellow';
  } else if (report.overallScore >= 30) {
    report.scoreLevel = 'zayıf';
    report.scoreColor = 'orange';
  } else {
    report.scoreLevel = 'kötü';
    report.scoreColor = 'red';
  }

  return report;
};

// Get Detailed On-Page SEO Analysis
const getDetailedOnPageSEO = async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL parameter is required' 
      });
    }

    // Extract domain from URL
    const domain = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const options = {
      method: 'GET',
      hostname: 'website-analyze-and-seo-audit-pro.p.rapidapi.com',
      port: null,
      path: `/onpagepro.php?website=${domain}`,
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'website-analyze-and-seo-audit-pro.p.rapidapi.com'
      }
    };

    console.log('Making On-Page SEO API request with domain:', domain);

    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, function (res) {
        const chunks = [];

        res.on('data', function (chunk) {
          chunks.push(chunk);
        });

        res.on('end', function () {
          const body = Buffer.concat(chunks);
          try {
            const data = JSON.parse(body.toString());
            resolve(data);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', function (error) {
        reject(error);
      });

      req.end();
    });

    console.log('On-Page SEO API Response:', response);
    
    // Analyze on-page SEO data and create report
    const onPageReport = analyzeOnPageSEO(response, url);
    
    res.status(200).json({
      success: true,
      data: {
        ...response,
        report: onPageReport
      }
    });
  } catch (error) {
    console.error('On-Page SEO Analysis Error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'On-Page SEO API is not available. Please check your API key or subscription.',
      error: error.message
    });
  }
};

// Website Analyze and SEO Audit (PRO) API
const getWebsiteSEOAnalysis = async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                message: 'URL parameter is required' 
            });
        }

        const options = {
            method: 'GET',
            url: 'https://website-analyze-and-seo-audit-pro.p.rapidapi.com/aiseo.php',
            params: { url: url },
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                'x-rapidapi-host': 'website-analyze-and-seo-audit-pro.p.rapidapi.com'
            }
        };

        console.log('Making SEO API request with URL:', url);
        console.log('API Key:', process.env.RAPIDAPI_KEY ? 'Present' : 'Missing');
        console.log('Request options:', JSON.stringify(options, null, 2));

        const response = await axios.request(options);
        
        console.log('SEO API Response:', response.data);
        
        // Analyze SEO data and create report
        const seoReport = analyzeSEOData(response.data, url);
        
        res.status(200).json({
            success: true,
            data: {
                ...response.data,
                report: seoReport
            }
        });
    } catch (error) {
        console.error('SEO Analysis Error:', error.response?.data || error.message);
        console.error('Full error object:', error);
        

        
        // Return error when API is not available
        res.status(500).json({
            success: false,
            message: 'SEO API is not available. Please check your API key or subscription.',
            error: error.response?.data || error.message
        });
        return;
        
        res.status(500).json({
            success: false,
            message: 'Error fetching SEO analysis',
            error: error.response?.data || error.message
        });
    }
};

// PageSpeed Insights API
const getPageSpeedInsights = async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                message: 'URL parameter is required' 
            });
        }

        // Ensure URL has protocol
        let formattedUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            formattedUrl = `https://${url}`;
        }

        const options = {
            method: 'GET',
            url: 'https://pagespeed-insights.p.rapidapi.com/run_pagespeed',
            params: {
                url: formattedUrl,
                category: 'CATEGORY_UNSPECIFIED',
                strategy: 'STRATEGY_UNSPECIFIED'
            },
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                'x-rapidapi-host': 'pagespeed-insights.p.rapidapi.com'
            }
        };

        console.log('Making PageSpeed API request with URL:', formattedUrl);

        const response = await axios.request(options);
        
        console.log('PageSpeed API Response:', response.data);
        
        // Extract key performance metrics from the new response format
        const lighthouseResult = response.data.lighthouseResult;
        const audits = lighthouseResult?.audits || {};
        const categories = lighthouseResult?.categories || {};
        
        // Extract metrics from loadingExperience if available
        const loadingExperience = response.data.loadingExperience;
        const metrics = loadingExperience?.metrics || {};
        
        // Extract metrics from audits for more detailed data
        const firstContentfulPaint = audits['first-contentful-paint']?.displayValue || 
                                   (metrics.FIRST_CONTENTFUL_PAINT_MS?.percentile ? `${metrics.FIRST_CONTENTFUL_PAINT_MS.percentile}ms` : 'N/A');
        
        const largestContentfulPaint = audits['largest-contentful-paint']?.displayValue || 
                                     (metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ? `${metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile}ms` : 'N/A');
        
        const speedIndex = audits['speed-index']?.displayValue || 'N/A';
        const totalBlockingTime = audits['total-blocking-time']?.displayValue || 'N/A';
        const cumulativeLayoutShift = audits['cumulative-layout-shift']?.displayValue || 
                                     (metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ? `${metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile}` : 'N/A');
        
        const performanceMetrics = {
            firstContentfulPaint,
            largestContentfulPaint,
            speedIndex,
            totalBlockingTime,
            cumulativeLayoutShift,
            performanceScore: categories.performance?.score ? Math.round(categories.performance.score * 100) : 0
        };

        const pageSpeedData = {
            url: response.data.id,
            performanceMetrics,
            fullResponse: response.data
        };

        // Analyze PageSpeed data and create report
        const pageSpeedReport = analyzePageSpeedData(pageSpeedData);

        res.status(200).json({
            success: true,
            data: {
                ...pageSpeedData,
                report: pageSpeedReport
            }
        });
    } catch (error) {
        console.error('PageSpeed Insights Error:', error.response?.data || error.message);
        
        // Return error when API is not available
        res.status(500).json({
            success: false,
            message: 'PageSpeed API is not available. Please check your API key or subscription.',
            error: error.response?.data || error.message
        });
        return;
        
        res.status(500).json({
            success: false,
            message: 'Error fetching PageSpeed insights',
            error: error.response?.data || error.message
        });
    }
};

// Combined API endpoint that returns both SEO analysis and PageSpeed insights
const getCombinedSEOData = async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                message: 'URL parameter is required' 
            });
        }

        // Make both API calls in parallel
        const [seoResponse, pageSpeedResponse] = await Promise.allSettled([
            getWebsiteSEOAnalysis({ query: { url } }, { status: () => ({ json: () => {} }) }),
            getPageSpeedInsights({ query: { url } }, { status: () => ({ json: () => {} }) })
        ]);

        const result = {
            success: true,
            data: {
                seoAnalysis: seoResponse.status === 'fulfilled' ? seoResponse.value : null,
                pageSpeedInsights: pageSpeedResponse.status === 'fulfilled' ? pageSpeedResponse.value : null,
                errors: {
                    seo: seoResponse.status === 'rejected' ? seoResponse.reason.message : null,
                    pageSpeed: pageSpeedResponse.status === 'rejected' ? pageSpeedResponse.reason.message : null
                }
            }
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('Combined SEO Data Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching combined SEO data',
            error: error.message
        });
    }
};

module.exports = {
    getWebsiteSEOAnalysis,
    getPageSpeedInsights,
    getCombinedSEOData,
    getDetailedOnPageSEO
};
