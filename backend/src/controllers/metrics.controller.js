const orderQueue = require('../queues/order.queue');

exports.getMetrics = async(req,res)=>{

    const waiting =
        await orderQueue.getWaitingCount();

    const active =
        await orderQueue.getActiveCount();

    const completed =
        await orderQueue.getCompletedCount();

    const failed =
        await orderQueue.getFailedCount();

    const delayed =
        await orderQueue.getDelayedCount();

    res.json({
        waiting,
        active,
        completed,
        failed,
        delayed
    });

};