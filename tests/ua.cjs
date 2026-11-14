// Identité du téléphone simulé (v2.1.4) : iPhone par défaut, Android avec MC_DEVICE=android
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};
module.exports = { userAgent: UA[process.env.MC_DEVICE || 'iphone'] || UA.iphone };
