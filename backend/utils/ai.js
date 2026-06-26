// AI Tools Generator Helper
// Generates production-ready, highly tailored marketing descriptions and SEO tags using heuristics

const marketingTemplates = [
  "Introducing the brand new {title}. Specifically designed for users seeking top-tier efficiency in {category}. Built using premium materials and utilizing the latest industry innovations.",
  "Experience unparalleled performance with the {title}. This product sets a new benchmark in the {category} space, offering state-of-the-art features including {attributes} that adapt to your daily workflow.",
  "Elevate your lifestyle with {title}. A masterclass in modern design, it combines aesthetic elegance with robust capabilities. Perfect for {category} enthusiasts who demand the absolute best."
];

function generateProductDescription(title, category, attributes = []) {
  const template = marketingTemplates[Math.floor(Math.random() * marketingTemplates.length)];
  const attrsString = attributes.length > 0 
    ? attributes.map(a => `${a.name.toLowerCase()} options (${a.values.join(', ')})`).join(', and ')
    : "premium specifications";

  let desc = template
    .replace('{title}', title)
    .replace('{category}', category || 'marketplace')
    .replace('{attributes}', attrsString);

  // Add bullet points for structure
  desc += "\n\nKey Highlights:\n";
  desc += `• High Quality Engineering: Rigorously tested for durability and long-term usage.\n`;
  desc += `• Smart Customization: Fully configurable with key features built directly for maximum comfort.\n`;
  if (attributes.length > 0) {
    attributes.forEach(attr => {
      desc += `• Available in multiple ${attr.name} options: ${attr.values.join(', ')}.\n`;
    });
  }
  desc += `• Eco-Friendly Packaging: Shipped in sustainable, biodegradable packaging.`;

  return desc;
}

function generateSeoTags(title, description = '', keywords = '') {
  const seoTitle = `${title} | Premium Multi-Vendor Marketplace`;
  
  // Clean description for SEO snippet
  const cleanDesc = description.replace(/[•\n]/g, ' ').substring(0, 150).trim();
  const seoDescription = cleanDesc || `Buy ${title} on our Multi-Vendor Marketplace. Enjoy secure payment options, quick delivery, and top-tier support.`;
  
  // Create list of keywords
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const keywordArray = [...new Set([...titleWords, 'marketplace', 'buy online', 'ecommerce', ...keywords.split(',').map(k => k.trim()).filter(Boolean)])];
  const seoKeywords = keywordArray.join(', ');

  return {
    seo_title: seoTitle,
    seo_description: seoDescription,
    seo_keywords: seoKeywords
  };
}

module.exports = {
  generateProductDescription,
  generateSeoTags
};
