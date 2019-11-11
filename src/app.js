// GoToWhere startup script

import $ from 'jquery';
window.jQuery = $;
window.$ = $;
import JSZip from 'jszip';
import JSZipUtils from 'jszip-utils';
window.JSZip = JSZip;
window.JSZipUtils = JSZipUtils;

var req = require.context("@wikimedia/jquery.i18n/src");

var files = ["js", "messagestore", "fallbacks", "parser", "emitter", "language"];
files.forEach(function (module) {
    req("./jquery.i18n." + module);
});

import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import './timeline.css';

import 'smartwizard';
import 'smartwizard/dist/css/smart_wizard.css';

import '@fortawesome/fontawesome-free/js/fontawesome';
import '@fortawesome/fontawesome-free/js/solid';
import '@fortawesome/fontawesome-free/js/regular';
import '@fortawesome/fontawesome-free/js/brands';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(registration => {
            console.log('SW registered: ', registration);
        }).catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
        });
    });
}

var __headerTexts = ["<i class=\"fas fa-map-marked-alt\"></i> \u53bb\u908a\u35ce GoToWhere", "<i class=\"fas fa-map-marked-alt\"></i> GoToWhere<small>.ga</small>", "<i class=\"fas fa-map-marked-alt\"></i> HeuiBin<small>.ga</small>"];
var __stopHeaderAnimation = false;

function __headerAnimation(i) {
    if (__stopHeaderAnimation) {
        return;
    }

    if (i === undefined || i > 2) {
        i = 0;
    }
    $(".startup h1").html(__headerTexts[i]);
    $(".startup h1").fadeIn(2000, function () {
        $(".startup h1").fadeOut(2000, function () {
            __headerAnimation(i + 1);
        });
    });
}

$(document).ready(function () {
    adjustMargin();
    $(".startup .progress-panel").fadeIn(5000);
    $(".startup .container").fadeIn(2000, function () {
        __headerAnimation();
    });
    console.log("GoToWhere (c) 2019. Licensed under the MIT License.");
    $("#startup-status").html("Loading GoToWhere scripts...");
});

$(window).resize(function () {
    adjustMargin();
});

window.adjustMargin = function () {
    var nph = 0;
    $(".numeric-keypad .btn-group").each(function () {
        nph += $(this).height();
    });
    $(".letter-keypad").css("height", nph);

    var hh = $(".header").height();
    var dh = $(window).height();
    $(".desktop.half-map-container").css("height", dh - hh);
    $(".content-panel-container").css("height", dh - hh - nph);
};

/*
requirejs.config({
    baseUrl: 'js/lib',
    paths: {
        "xhook": "../xhook.min",
        "crypto-js": "../../vendor/crypto-js-3.1.9-1/crypto-js",
        "proj4": "../../vendor/proj4js-2.5.0/dist/proj4"
    }
});
*/

import * as Cors from './gtw-cors';
import * as PluginLoader from './gtw-pluginloader';
import * as Transit from './gtw-citydata-transit';
import * as TransitEta from './gtw-citydata-transit-eta';
import * as Map from './gtw-map';
import * as loc from './gtw-location';
import * as ui from './gtw-ui';
import * as settings from './gtw-settings';
import * as RequestLimiter from './gtw-requestlimiter';
import * as log from './gtw-log';
import * as lang from './gtw-lang';
import * as Database from './gtw-db';
import proj4 from 'proj4';

$(".build-version").html(VERSION);

proj4.defs("EPSG:2326", "+proj=tmerc +lat_0=22.31213333333334 +lon_0=114.1785555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,0.067753,-2.24365,-1.15883,-1.09425 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

settings.load();

lang.changeLanguage(settings.get("preferred_language", "en"));

RequestLimiter.start();

Cors.register("www.gotowhere.ga", true);
Cors.register("plugins.gotowhere.ga", true);

$("#startup-status").html($.i18n("startup-status-downloading-plugins"));

$("#startup-progress").css("width", "12.5%");
$("#startup-status").html($.i18n("startup-status-open-db"));
var promise = Database.open();

if (!promise) {
    $("#startup-status").attr("style", "color: red");
    $("#startup-status").html($.i18n("startup-status-not-supported"));
} else {
    promise.then(function () {
        $("#startup-progress").css("width", "25%");
        $("#startup-status").html($.i18n("startup-status-loading-plugins"));
        promise = PluginLoader.load(function (progress) {
            $("#startup-progress").css("width", 25 + (progress / 8) + "%");
        });
        promise.then(function () {
            $("#startup-status").html($.i18n("startup-status-obtaining-db-version"));
            promise = Transit.obtainDatabaseVersion(function (progress) {
                $("#startup-progress").css("width", (25 + progress / 4 * 3) + "%");
            });
            promise.then(function () {
                $("#startup-status").html($.i18n("startup-status-checking-db-update"));
                promise = Transit.checkDatabaseUpdate(function (progress) {
                    $("#startup-progress").css("width", (25 + progress / 4 * 3) + "%");
                });
                promise.then(function () {
                    $("#startup-status").html($.i18n("startup-status-downloading-db"));
                    promise = Transit.downloadDatabase(function (progress) {
                        console.log(progress);
                        $("#startup-progress").css("width", (25 + progress / 4 * 3) + "%");
                    });
                    promise.then(function () {
                        $("#startup-status").html($.i18n("startup-status-preparing-update"));
                        promise = Transit.prepareUpdate(function (progress) {
                            console.log(progress);
                            $("#startup-progress").css("width", (25 + progress / 4 * 3) + "%");
                        });
                        promise.then(function () {
                            $("#startup-status").html($.i18n("startup-status-reading-chunks"));
                            promise = Transit.readChunks(function (progress) {
                                console.log(progress);
                                $("#startup-progress").css("width", (25 + progress / 4 * 3) + "%");
                            });
                            promise.then(function () {
                                $("#startup-status").html($.i18n("startup-status-storing-db"));
                                promise = Transit.waitToStore(function (progress) {
                                    console.log(progress);
                                    $("#startup-progress").css("width", (25 + progress / 4 * 3) + "%");
                                });
                                promise.then(function () {
                                    $("#startup-progress").css("width", "100%");
                                    $("#startup-status").html($.i18n("startup-status-init-map"));
                                    promise = Map.init();
                                    promise.then(function () {
                                        $("#startup-status").html($.i18n("startup-status-finish"));
                                        $(".build-version").fadeOut(2000);

                                        var lastVer = localStorage.getItem("gtw-lastversion");
                                        if (lastVer && lastVer !== VERSION) {
                                            console.log("Application updated to " + VERSION + ". Showing change-log.");
                                            ui.showModal("updated", VERSION);
                                        }
                                        localStorage.setItem("gtw-lastversion", VERSION);

                                        ui.init();

                                        //TransitManager.start();
                                        //TransitManager.forceUpdate();

                                        var errPlugins = [];
                                        var plugin;
                                        for (var pluginKey in PluginLoader.plugins) {
                                            plugin = PluginLoader.plugins[pluginKey];
                                            if (plugin.status < 0) {
                                                errPlugins.push(plugin);
                                            }
                                        }
                                        console.log(errPlugins);

                                        if (errPlugins.length) {
                                            ui.showModal("errorplugins", errPlugins);
                                        }

                                        loc.requestLocationAccess(function () {
                                            //ui.init();
                                            //TransitManager.forceUpdate();
                                            $("#loc-status-btn").addClass("btn-success");
                                            $("#loc-status-btn").removeClass("btn-warning");
                                            setTimeout(function () {
                                                $("#loc-status-btn").fadeOut(500);
                                            }, 2000);
                                        }, function () {
                                            $("#loc-status-btn").addClass("btn-danger");
                                            $("#loc-status-btn").removeClass("btn-warning");
                                            $("#loc-status-btn").append(" <span> No Location!</span>");
                                            setTimeout(function () {
                                                $("#loc-status-btn span").fadeOut(500);
                                            }, 5000);
                                        });

                                        setTimeout(function () {
                                            $(".footer").animate({ height: 0, opacity: 0 }, 1000, function () {
                                                $(".footer").css("display", "none");
                                            });
                                        }, 2000);
                                        $(".startup").fadeOut(1000, function () {
                                            __stopHeaderAnimation = true;
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}