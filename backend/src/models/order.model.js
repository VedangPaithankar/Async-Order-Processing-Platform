const OrderStatus = {
  RECEIVED: 'RECEIVED',
  QUEUED: 'QUEUED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

const FulfillmentType = {
  PICKUP: 'PICKUP',
  DELIVERY: 'DELIVERY'
};

const PaymentMethod = {
  UPI_GPAY: 'UPI_GPAY',
  UPI_PHONEPE: 'UPI_PHONEPE',
  UPI_PAYTM: 'UPI_PAYTM',
  CARD: 'CARD',
  CASH_AT_COUNTER: 'CASH_AT_COUNTER'
};

module.exports = { OrderStatus, FulfillmentType, PaymentMethod }; 
