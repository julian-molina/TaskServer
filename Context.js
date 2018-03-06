﻿exports.newContext = function newContext(BOT) {

    /* 

    This module allows trading bots to connect to the exchange and do trding operations on it. So far it can only work with Poloniex.
    It deals with these 3 different files that helps the bot process remember where it is standing:

    1. The Status Report.
    2. The Execution History.
    3. The Execution Context.

    */

    const MODULE_NAME = "Context";

    /*

    Here we will keep the last status report, to be available during the whole process. The Status Report is a file the bot process
    reads and saves again after each execution. Its main purpose is to know when the last execution was in order to locate the execution
    context. When the bot runs for the first time it takes some vital parameters from there and it checks them through its lifecycle to see
    if they changed. The Status Report file can eventually be manipulated by the bot operators / developers in order to change those parameters
    or to point the last execution to a different date. Humans are not supose to manipulate the Execution Histroy or the execution Context files.

    The Execution History is basically an index with dates of all the executions the bot did across its history. It allows the bot plotter
    to know which datetimes have informacion about the bots execution in order to display it.

    The Execution Context file records all the context information of the bot at the moment of execution and the final state of all of its
    positions on the market.

    */

    thisObject = {
        statusReport: undefined,            // Here is the information that defines which was the last sucessfull execution and some other details.
        executionHistory: undefined,        // This is the record of bot execution.
        executionContext: undefined,        // Here is the business information of the last execution of this bot process.
        newHistoryRecord : {
            date: processDatetime,
            rate: 0,                        // This will be used to know where to plot this information in the time line. 
            newPositions: 0,
            newTrades: 0,
            movedPositions: 0
        },
        initialize: initialize,
        saveAll: saveAll
    };

    /*

    During the process we will create a new History Record. This will go to the Context History file which essentially mantains an
    index of all the bots executions. This file will later be plotted by the bot s plotter on the timeline, allowing end users to
    know where there is information related to the actions taken by the bot.

    */

    const EXCHANGE_NAME = "Poloniex";
    let bot = BOT;

    const DEBUG_MODULE = require('./Debug Log');
    const logger = DEBUG_MODULE.newDebugLog();
    logger.fileName = MODULE_NAME;

    /* Storage account to be used here. */

    const FILE_STORAGE = require('./Azure File Storage');
    let cloudStorage = FILE_STORAGE.newAzureFileStorage(bot);

    let processDatetime;

    return thisObject;

    function initialize(pProcessDatetime, callBackFunction) {

        try {
            /*

            Here we get the positions the bot did and that are recorded at the bot storage account. We will use them through out the rest
            of the process.

            */

            cloudStorage.initialize(bot.name);

            thisObject.newHistoryRecord.date = pProcessDatetime;
            processDatetime = pProcessDatetime; 

            getStatusReport();

            function getStatusReport() {

                /* If the process run and was interrupted, there should be a status report that allows us to resume execution. */

                let fileName = "Status.Report.json"
                let filePath = EXCHANGE_NAME + "/" + bot.name + "/" + bot.dataSetVersion + "/Processes/" + bot.process;

                cloudStorage.getTextFile(filePath, fileName, onFileReceived, true);

                function onFileReceived(text) {

                    try {

                        thisObject.statusReport = JSON.parse(text);

                        if (thisObject.statusReport.lastExecution === undefined) {

                            createConext();

                        } else {

                            getExecutionHistory();

                        }

                    } catch (err) {

                        /*

                        It might happen that the file content is corrupt or it does not exist. The bot can not run without a Status Report,
                        since it is risky to ignore its own history, so even for first time execution, a status report with the right format
                        is needed.

                        */

                        logger.write("[ERROR] initialize -> getStatusReport -> Bot cannot execute without the Status report. -> Err = " + err.message);

                    }
                }
            }

            function getExecutionHistory() {

                let fileName = "Execution.History.json"
                let filePath = EXCHANGE_NAME + "/" + bot.name + "/" + bot.dataSetVersion + "/Output/" + bot.process;

                cloudStorage.getTextFile(filePath, fileName, onFileReceived, true);

                function onFileReceived(text) {

                    try {

                        thisObject.executionHistory = JSON.parse(text);
                        getExecutionContext();

                    } catch (err) {

                        /*

                        It might happen that the file content is corrupt or it does not exist. The bot can not run without a Status Report,
                        since it is risky to ignore its own history, so even for first time execution, a status report with the right format
                        is needed.

                        */

                        logger.write("[ERROR] initialize -> getExecutionHistory -> Bot cannot execute without the Execution History. -> Err = " + err.message);

                    }
                }
            }

            function getExecutionContext() {

                let date = new Date(thisObject.statusReport.lastExecution);

                let fileName = "Execution.Context.json"
                let dateForPath = date.getUTCFullYear() + '/' + utilities.pad(date.getUTCMonth() + 1, 2) + '/' + utilities.pad(date.getUTCDate(), 2) + '/' + utilities.pad(date.getUTCHours(), 2) + '/' + utilities.pad(date.getUTCMinutes(), 2);
                let filePath = EXCHANGE_NAME + "/" + bot.name + "/" + bot.dataSetVersion + "/Output/" + bot.process + "/" + dateForPath;

                cloudStorage.getTextFile(filePath, fileName, onFileReceived, true);

                function onFileReceived(text) {

                    try {

                        thisObject.executionContext = JSON.parse(text);

                        thisObject.executionContext.transactions = []; // We record here the transactions that happened duting this execution.

                        ordersExecutionCheck();

                    } catch (err) {

                        /*

                        It might happen that the file content is corrupt or it does not exist. The bot can not run without a Status Report,
                        since it is risky to ignore its own history, so even for first time execution, a status report with the right format
                        is needed.

                        */

                        logger.write("[ERROR] initialize -> getExecutionContext -> Bot cannot execute without the Execution Context. -> Err = " + err.message);

                    }
                }
            }

            function createConext() {

                /*
    
                When the bot is executed for the very first time, there are a few files that do not exist and need to be created, and that
                is what we are going to do now.
    
                */

                thisObject.executionHistory = [];

                thisObject.executionContext = {
                    investment: {
                        assetA: 0,
                        assetB: 0
                    },
                    availableBalance: {
                        assetA: 0,
                        assetB: 0
                    },
                    positions: [],
                    transactions: []
                };

                callBackFunction();

            }

        } catch (err) {

            logger.write("[ERROR] initialize -> err = " + err);
            callBackFunction("Operation Failed.");
        }
    }

    function saveAll(callBackFunction) {

        try {

            writeExecutionContext();

            function writeExecutionContext() {

                if (LOG_INFO === true) {
                    logger.write("[INFO] Entering function 'writeExecutionContext'");
                }

                try {

                    let fileName = "Execution.Context.json"
                    let dateForPath = processDatetime.getUTCFullYear() + '/' + utilities.pad(processDatetime.getUTCMonth() + 1, 2) + '/' + utilities.pad(processDatetime.getUTCDate(), 2) + '/' + utilities.pad(processDatetime.getUTCHours(), 2) + '/' + utilities.pad(processDatetime.getUTCMinutes(), 2);
                    let filePath = EXCHANGE_NAME + "/" + bot.name + "/" + bot.dataSetVersion + "/Output/" + bot.process + "/" + dateForPath;

                    utilities.createFolderIfNeeded(filePath, cloudStorage, onFolderCreated);

                    function onFolderCreated() {

                        try {

                            let fileContent = JSON.stringify(thisObject.executionContext);

                            cloudStorage.createTextFile(filePath, fileName, fileContent + '\n', onFileCreated);

                            function onFileCreated() {

                                if (LOG_INFO === true) {
                                    logger.write("[INFO] 'writeExecutionContext' - Content written: " + fileContent);
                                }

                                writeExucutionHistory();
                            }
                        }
                        catch (err) {
                            const logText = "[ERROR] 'writeExecutionContext - onFolderCreated' - ERROR : " + err.message;
                            logger.write(logText);
                        }
                    }

                }
                catch (err) {
                    const logText = "[ERROR] 'writeExecutionContext' - ERROR : " + err.message;
                    logger.write(logText);
                }
            }

            function writeExucutionHistory() {

                if (LOG_INFO === true) {
                    logger.write("[INFO] Entering function 'writeExucutionHistory'");
                }

                try {

                    let fileName = "Execution.History.json"
                    let filePath = EXCHANGE_NAME + "/" + bot.name + "/" + bot.dataSetVersion + "/Output/" + bot.process;

                    utilities.createFolderIfNeeded(filePath, cloudStorage, onFolderCreated);

                    function onFolderCreated() {

                        try {

                            let newRecord = [
                                newHistoryRecord.date.valueOf(),
                                newHistoryRecord.rate,
                                newHistoryRecord.newPositions,
                                newHistoryRecord.newTrades,
                                newHistoryRecord.movedPositions
                            ];

                            thisObject.executionHistory.push(newRecord);

                            let fileContent = JSON.stringify(thisObject.executionHistory);

                            cloudStorage.createTextFile(filePath, fileName, fileContent + '\n', onFileCreated);

                            function onFileCreated() {

                                if (LOG_INFO === true) {
                                    logger.write("[INFO] 'writeExucutionHistory'");
                                }

                                writeStatusReport();
                            }
                        }
                        catch (err) {
                            const logText = "[ERROR] 'writeExucutionHistory - onFolderCreated' - ERROR : " + err.message;
                            logger.write(logText);
                        }
                    }

                }
                catch (err) {
                    const logText = "[ERROR] 'writeExucutionHistory' - ERROR : " + err.message;
                    logger.write(logText);
                }
            }

            function writeStatusReport() {

                if (LOG_INFO === true) {
                    logger.write("[INFO] Entering function 'writeStatusReport'");
                }

                try {

                    let fileName = "Status.Report.json"
                    let filePath = EXCHANGE_NAME + "/" + bot.name + "/" + bot.dataSetVersion + "/Processes/" + bot.process;

                    utilities.createFolderIfNeeded(filePath, cloudStorage, onFolderCreated);

                    function onFolderCreated() {

                        try {

                            thisObject.statusReport.lastExecution = processDatetime;

                            let fileContent = JSON.stringify(thisObject.statusReport);

                            cloudStorage.createTextFile(filePath, fileName, fileContent + '\n', onFileCreated);

                            function onFileCreated() {

                                if (LOG_INFO === true) {
                                    logger.write("[INFO] 'writeStatusReport' - Content written: " + fileContent);
                                }

                                callBackFunction(true); // We tell the AA Platform that we request a regular execution and finish the bot s process.
                                return;
                            }
                        }
                        catch (err) {
                            const logText = "[ERROR] 'writeStatusReport - onFolderCreated' - ERROR : " + err.message;
                            logger.write(logText);
                        }
                    }

                }
                catch (err) {
                    const logText = "[ERROR] 'writeStatusReport' - ERROR : " + err.message;
                    logger.write(logText);
                }
            }

        } catch (err) {
            logger.write("[ERROR] saveAll -> Error = " + err.message);
            callBackFunction("Operation Failed.");
        }
    }

};