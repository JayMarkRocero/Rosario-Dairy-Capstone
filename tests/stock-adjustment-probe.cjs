const { AxiosError } = require('axios');
/** Existing fixtures model the new backend's non-mutating UUID validation. */
function installStockAdjustmentProbe(http) {
  http.interceptors.request.use(config => {
    const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    if (config.url === '/inventory/stock-adjustments/' && data?.request_id === '' && data.product_batch_id === 0) {
      config.adapter = async request => { throw new AxiosError('Invalid UUID', undefined, request, undefined,
        { config: request, status: 400, headers: {}, data: { request_id: ['Must be a valid UUID.'] } }); };
    }
    return config;
  }, undefined, { synchronous: true });
}
module.exports = { installStockAdjustmentProbe };
