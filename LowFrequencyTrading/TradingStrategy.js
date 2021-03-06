exports.newTradingStrategy = function newTradingStrategy(bot, logger, tradingEngineModule) {
    /*
    This module packages all functions related to Strategies.
    */
    const MODULE_NAME = 'Trading Strategy'
    let thisObject = {
        mantain: mantain,
        reset: reset,
        openStrategy: openStrategy,
        closeStrategy: closeStrategy,
        initialize: initialize,
        finalize: finalize
    }

    let tradingEngine
    let sessionParameters

    return thisObject

    function initialize() {
        tradingEngine = bot.simulationState.tradingEngine
        sessionParameters = bot.SESSION.parameters
    }

    function finalize() {
        tradingEngine = undefined
        sessionParameters = undefined
    }

    function mantain() {
        updateCounters()
        updateEnds()
    }

    function reset() {
        resetTradingEngineDataStructure()
    }

    function openStrategy(index, situationName, strategyName) {
        /* Starting begin and end */
        tradingEngine.current.strategy.begin.value = tradingEngine.current.episode.cycle.lastBegin.value
        tradingEngine.current.strategy.end.value = tradingEngine.current.episode.cycle.lastEnd.value

        /* Recording the opening at the Trading Engine Data Structure */
        tradingEngine.current.strategy.status.value = 'Open'
        tradingEngine.current.strategy.serialNumber.value = tradingEngine.current.episode.episodeCounters.strategies.value
        tradingEngine.current.strategy.identifier.value = global.UNIQUE_ID()
        tradingEngine.current.strategy.beginRate.value = tradingEngine.current.episode.candle.min.value

        tradingEngine.current.strategy.index.value = index
        tradingEngine.current.strategy.situationName.value = situationName
        tradingEngine.current.strategy.strategyName.value = strategyName

        /* Updating Episode Counters */
        tradingEngine.current.episode.episodeCounters.strategies.value++
    }

    function closeStrategy(exitType) {
        tradingEngine.current.strategy.status.value = 'Closed'
        tradingEngine.current.strategy.exitType.value = exitType
        tradingEngine.current.strategy.end.value = tradingEngine.current.episode.cycle.lastEnd.value
        tradingEngine.current.strategy.endRate.value = tradingEngine.current.episode.candle.min.value
        /*
        Now that the strategy is closed, it is the right time to move this strategy from current to last at the Trading Engine data structure.
        */
        tradingEngineModule.cloneValues(tradingEngine.current.strategy, tradingEngine.last.strategy)
    }

    function updateEnds() {
        if (tradingEngine.current.strategy.status.value === 'Open') {
            tradingEngine.current.strategy.end.value = tradingEngine.current.strategy.end.value + sessionParameters.timeFrame.config.value
            tradingEngine.current.strategy.endRate.value = tradingEngine.current.episode.candle.close.value
        }
    }

    function resetTradingEngineDataStructure() {
        if (tradingEngine.current.strategy.status.value === 'Closed') {
            tradingEngineModule.initializeNode(tradingEngine.current.strategy)
        }
    }

    function updateCounters() {
        if (tradingEngine.current.strategy.status.value === 'Open') {
            tradingEngine.current.strategy.strategyCounters.periods.value++
        }
    }
}