//GTW GTFS-static Database
import { dbPromise } from './gtw-db';
import * as Misc from './gtw-misc';

//TODO: Incomplete GTFS static Implementation
//      Only implements agency, stops, routes, trips,
//      stop_times, calendar, calendar_dates, fare_attributes,
//      fare_rules, frequencies. And conditional requirements
//      are currently ignored and followed data.gov.hk specification.

//
// Logical functions
//

export function searchNearbyStops(lat, lng, range, sorted = true) {
    var out = [];
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_stops", "readonly");
        var store = tx.objectStore("gtfs_stops");
        return store.openCursor();
    }).then(function iterate(cursor) {
        if (!cursor) {
            if (sorted) {
                out.sort(function (a, b) {
                    return a.distance - b.distance;
                });
            }
            return out;
        }
        var distance = Misc.geoDistance(lat, lng, cursor.value["stop_lat"], cursor.value["stop_lon"]);
        if (distance <= range) {
            out.push({
                distance: distance,
                stop: cursor.value
            });
        }
        return cursor.continue().then(iterate);
    });
}

export function searchStopRoutes(pkg, provider, stopId) {
    var tripIds = [];
    var routeIds = [];
    var routes = {};
    var trips = {};
    var stopTimes = {};
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_stop_times", "readonly");
        var store = tx.objectStore("gtfs_stop_times");
        var index = store.index("stop_id");
        return index.openCursor(IDBKeyRange.lowerBound(stopId));
    }).then(function iterate(cursor) {
        if (!cursor || cursor.value["stop_id"] !== stopId) {
            return dbPromise;
        }
        if (cursor.value["package"] === pkg && cursor.value["provider"] === provider) {
            var id = cursor.value["trip_id"];
            tripIds.push(id);
            stopTimes[id] = cursor.value;
        }
        return cursor.continue().then(iterate);
    }).then(function (db) {
        var tx = db.transaction("gtfs_trips", "readonly");
        var store = tx.objectStore("gtfs_trips");
        //TODO: Set bounds after standardizing ID datatype
        return store.openCursor();
    }).then(function iterate(cursor) {
        if (!cursor) {
            return dbPromise;
        }
        if (cursor.value["package"] === pkg && cursor.value["provider"] === provider && tripIds.includes(cursor.value["trip_id"])) {
            var id = cursor.value["route_id"];
            routeIds.push(id);
            trips[id] = cursor.value;
        }
        return cursor.continue().then(iterate);
    }).then(function (db) {
        var tx = db.transaction("gtfs_routes", "readonly");
        var store = tx.objectStore("gtfs_routes");
        //TODO: Set bounds after standardizing ID datatype
        return store.openCursor();
    }).then(function iterate(cursor) {
        if (!cursor) {
            return {
                routes: routes,
                trips: trips,
                stopTimes: stopTimes
            };
        }
        var id = cursor.value["route_id"];
        if (cursor.value["package"] === pkg && cursor.value["provider"] === provider && routeIds.includes(id)) {
            routes[id] = cursor.value;
        }
        return cursor.continue().then(iterate);
    });
}

export function csvToObject(csv) {
    var rows = csv.split("\r\n");
    var headers = csvSplit(rows.shift());
    console.log(headers);
    var out = [];
    var i;
    var rowSplits;
    var rowObj;
    for (var row of rows) {
        rowObj = {};
        rowSplits = csvSplit(row);
        for (i = 0; i < headers.length; i++) {
            rowObj[headers[i]] = rowSplits[i];
        }
        out.push(rowObj);
    }
    return out;
}

export function csvSplit(text) {
    var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    // Return NULL if input string is not well formed CSV string.
    //if (!re_valid.test(text)) return null;
    var a = [];                     // Initialize array to receive values.
    text.replace(re_value, // "Walk" the string using replace with callback.
        function (m0, m1, m2, m3) {
            // Remove backslash from \' in single quoted values.
            if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
            // Remove backslash from \" in double quoted values.
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
            else if (m3 !== undefined) a.push(m3);
            return ''; // Return empty string.
        });
    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) a.push('');
    return a;
};

//
// Database setters and getters
//

export function putVersion(pkg, provider, version) {
    if (!pkg || !provider || !version) {
        console.error("Error: putVersion missing pkg, provider or version parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_versions", "readwrite");
            var store = tx.objectStore("gtfs_versions");
            var req = store.put({
                "package": pkg,
                provider: provider,
                version: version
            });
            req.onsuccess = resolve;
            req.onerror = reject;
        });
    });
}

export function getVersion(pkg, provider) {
    if (!pkg || !provider) {
        console.error("Error: getVersion missing pkg, provider parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_versions", "readonly");
            var store = tx.objectStore("gtfs_versions");
            var request = store.get([pkg, provider]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

export function put(pkg, provider, dataType, data) {
    if (dataType === "agency") {
        return putAgencies(pkg, provider, data);
    } else if (dataType === "calendar_dates") {
        return putCalendarDates(pkg, provider, data);
    } else if (dataType === "calendar") {
        return putCalendars(pkg, provider, data);
    } else if (dataType === "fare_attributes") {
        return putFareAttributes(pkg, provider, data);
    } else if (dataType === "fare_rules") {
        return putFareRules(pkg, provider, data);
    } else if (dataType === "frequencies") {
        return putFrequencies(pkg, provider, data);
    } else if (dataType === "routes") {
        return putRoutes(pkg, provider, data);
    } else if (dataType === "stops") {
        return putStops(pkg, provider, data);
    } else if (dataType === "stop_times") {
        return putStopTimes(pkg, provider, data);
    } else if (dataType === "trips") {
        return putTrips(pkg, provider, data);
    } else {
        console.error("Error: Invalid put function for data type: " + dataType);
        return false;
    }
}

//Required: fare_id (string)
//Cond/Optional: route_id, origin_id, destination_id, contains_id (string)
export function putFareRules(pkg, provider, data) {
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putGtfsFareRules missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        if (datum["fare_id"] === undefined) {
            console.error("Error: GTFS fare rules datum structure invalid at index " + i + ".");
            return false;
        }

        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_fare_rules", "readwrite");
        var store = tx.objectStore("gtfs_fare_rules");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.put(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        return Promise.all(proms);
    });
}

export function getFareRulesByFareId(pkg, provider, fareId) {
    if (!pkg || !provider) {
        console.error("Error: getFareRulesByFareId missing pkg, provider, fareId parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_fare_rules", "readonly");
            var store = tx.objectStore("gtfs_fare_rules");
            var request = store.get([pkg, provider, fareId]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

window.storeMs = 0;
window.storeCount = 0;
//Required: fare_id (string), price (number), currency_type (string), payment_method (number), transfers (number), agency_id (string)
//Cond/Optional: transfer_duration (number)
export function putFareAttributes(pkg, provider, data) {
    var sst = Date.now();
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putFareAttributes missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        if (datum["fare_id"] === undefined || //Req
            datum["price"] === undefined || //Req
            datum["currency_type"] === undefined || //Req
            datum["payment_method"] === undefined || //Req
            datum["transfers"] === undefined || //Req
            datum["agency_id"] === undefined //Cond Req
        ) {
            console.error("Error: GTFS fare attributes datum structure invalid at index " + i + ".");
            debugger;
            return false;
        }

        datum["price"] = parseFloat(datum["price"]);
        datum["payment_method"] = parseInt(datum["payment_method"]);
        datum["transfers"] = parseInt(datum["transfers"]);
        if (datum["transfer_duration"] !== undefined) {
            datum["transfer_duration"] = parseInt(datum["transfer_duration"]);
        }

        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_fare_attributes", "readwrite");
        var store = tx.objectStore("gtfs_fare_attributes");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.add(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        storeMs += Date.now() - sst;
        storeCount++;
        return Promise.all(proms);
    });
}

export function getFareAttributesByFareId(pkg, provider, fareId) {
    if (!pkg || !provider) {
        console.error("Error: getFareAttributesByFareId missing pkg, provider, fareId parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_fare_attributes", "readonly");
            var store = tx.objectStore("gtfs_fare_attributes");
            var request = store.get([pkg, provider, fareId]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

//Required: stop_id (string), location_type (number)
//Cond/Optional: stop_code (string), stop_name (string), stop_desc (string), stop_lat (float),
//               stop_lon(float), zone_id(string), stop_url(string), parent_station (string),
//               stop_timezone (string), wheelchair_boarding (number), level_id (number),
//               platform_code (string)
export function putStops(pkg, provider, data) {
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putStops missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        if (datum["stop_id"] === undefined || //Req
            datum["location_type"] === undefined //Req
        ) {
            console.error("Error: GTFS stops datum structure invalid at index " + i + ".");
            return false;
        }

        datum["location_type"] = parseInt(datum["location_type"]);
        if (datum["stop_lat"] !== undefined) {
            datum["stop_lat"] = parseFloat(datum["stop_lat"]);
        }
        if (datum["stop_lng"] !== undefined) {
            datum["stop_lat"] = parseFloat(datum["stop_lat"]);
        }
        if (datum["wheelchair_boarding"] !== undefined) {
            datum["wheelchair_boarding"] = parseInt(datum["wheelchair_boarding"]);
        }
        if (datum["level_id"] !== undefined) {
            datum["level_id"] = parseInt(datum["level_id"]);
        }

        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_stops", "readwrite");
        var store = tx.objectStore("gtfs_stops");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.put(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        return Promise.all(proms);
    });
}

export function getStopByStopId(pkg, provider, stopId) {
    if (!pkg || !provider) {
        console.error("Error: getStopByStopId missing pkg, provider, stopId parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_stops", "readonly");
            var store = tx.objectStore("gtfs_stops");
            var request = store.get([pkg, provider, stopId]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

//Required: trip_id (string), stop_id (string), stop_sequence (number)
//Cond/Optional: arrival_time (string), departure_time (string), stop_headsign (string), pickup_type (number),
//               drop_off_type (number), shape_dist_traveled (float), timepoint (number)
export function putStopTimes(pkg, provider, data) {
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putStopTimes missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        if (datum["trip_id"] === undefined || //Req
            datum["stop_id"] === undefined || //Req
            datum["stop_sequence"] === undefined //Req
        ) {
            console.error("Error: GTFS stop times datum structure invalid at index " + i + ".");
            return false;
        }

        datum["stop_sequence"] = parseInt(datum["stop_sequence"]);
        if (datum["pickup_type"] !== undefined) {
            datum["pickup_type"] = parseInt(datum["pickup_type"]);
        }
        if (datum["drop_off_type"] !== undefined) {
            datum["drop_off_type"] = parseInt(datum["drop_off_type"]);
        }
        if (datum["shape_dist_traveled"] !== undefined) {
            datum["shape_dist_traveled"] = parseFloat(datum["shape_dist_traveled"]);
        }
        if (datum["timepoint"] !== undefined) {
            datum["timepoint"] = parseInt(datum["timepoint"]);
        }

        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_stop_times", "readwrite");
        var store = tx.objectStore("gtfs_stop_times");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.put(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        return Promise.all(proms);
    });
}

export function getStopTimeByTripId(pkg, provider, tripId) {
    if (!pkg || !provider) {
        console.error("Error: getStopTimeByTripId missing pkg, provider, tripId parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_stop_times", "readonly");
            var store = tx.objectStore("gtfs_stop_times");
            var request = store.get([pkg, provider, tripId]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

//Required: route_id (string), route_type (number), eta_providers (string array)
//Cond/Optional: agency_id (string), route_short_name (string), route_long_name (string), route_desc (string),
//               route_url (string), route_color (string), route_text_color (string), route_sort_order (number)
export function putRoutes(pkg, provider, data) {
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putRoutes missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        if (//GTFS-static specification
            datum["route_id"] === undefined || //Req
            datum["route_type"] === undefined //Req
            //Extended GTW standard
            //datum["eta_providers"] === undefined //Req
        ) {
            console.error("Error: GTFS routes datum structure invalid at index " + i + ".");
            return false;
        }

        datum["route_type"] = parseInt(datum["route_type"]);
        ///TODO: eta_providers
        if (datum["route_sort_order"] !== undefined) {
            datum["route_sort_order"] = parseInt(datum["route_sort_order"]);
        }

        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_routes", "readwrite");
        var store = tx.objectStore("gtfs_routes");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.put(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        return Promise.all(proms);
    });
}

export function getRouteByRouteId(pkg, provider, routeId) {
    if (!pkg || !provider) {
        console.error("Error: getRouteByRouteId missing pkg, provider, routeId parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_routes", "readonly");
            var store = tx.objectStore("gtfs_routes");
            var request = store.get([pkg, provider, routeId]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

//Required: route_id (string), service_id (string), trip_id (string)
//Cond/Optional: trip_headsign (string), trip_short_name (string), direction_id (string), block_id (string),
//               shape_id (string), wheelchair_accessible (number), bikes_allowed (number)
export function putTrips(pkg, provider, data) {
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putTrips missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        if (datum["route_id"] === undefined || //Req
            datum["service_id"] === undefined || //Req
            datum["trip_id"] === undefined //Req
        ) {
            console.error("Error: GTFS trips datum structure invalid at index " + i + ".");
            return false;
        }

        if (datum["wheelchair_accessible"] !== undefined) {
            datum["wheelchair_accessible"] = parseInt(datum["wheelchair_accessible"]);
        }
        if (datum["bikes_allowed"] !== undefined) {
            datum["bikes_allowed"] = parseInt(datum["bikes_allowed"]);
        }

        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_trips", "readwrite");
        var store = tx.objectStore("gtfs_trips");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.put(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        return Promise.all(proms);
    });
}

export function getTripByTripId(pkg, provider, tripId) {
    if (!pkg || !provider) {
        console.error("Error: getTripByTripId missing pkg, provider, tripId parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_trips", "readonly");
            var store = tx.objectStore("gtfs_trips");
            var request = store.get([pkg, provider, tripId]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

//Required: service_id (string), monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date (number)
export function putCalendars(pkg, provider, data) {
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putCalendars missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        //All Required
        if (datum["service_id"] === undefined ||
            datum["monday"] === undefined ||
            datum["tuesday"] === undefined ||
            datum["wednesday"] === undefined ||
            datum["thursday"] === undefined ||
            datum["friday"] === undefined ||
            datum["saturday"] === undefined ||
            datum["sunday"] === undefined ||
            datum["start_date"] === undefined ||
            datum["end_date"] === undefined
        ) {
            console.error("Error: GTFS calendars datum structure invalid at index " + i + ".");
            return false;
        }

        datum["monday"] = parseInt(datum["monday"]);
        datum["tuesday"] = parseInt(datum["tuesday"]);
        datum["wednesday"] = parseInt(datum["wednesday"]);
        datum["thursday"] = parseInt(datum["thursday"]);
        datum["friday"] = parseInt(datum["friday"]);
        datum["saturday"] = parseInt(datum["saturday"]);
        datum["sunday"] = parseInt(datum["sunday"]);
        datum["start_date"] = parseInt(datum["start_date"]);
        datum["end_date"] = parseInt(datum["end_date"]);

        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_calendar", "readwrite");
        var store = tx.objectStore("gtfs_calendar");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.put(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        return Promise.all(proms);
    });
}

export function getCalendarByServiceId(pkg, provider, serviceId) {
    if (!pkg || !provider) {
        console.error("Error: getCalendarByServiceId missing pkg, provider, serviceId parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_calendar", "readonly");
            var store = tx.objectStore("gtfs_calendar");
            var request = store.get([pkg, provider, serviceId]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

//Required: agency_name, agency_url, agency_timezone (string)
//Cond/Optional: agency_id, agency_lang, agency_phone, agency_fare_url, agency_email (string)
export function putAgencies(pkg, provider, data) {
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putAgencies missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        if (datum["agency_name"] === undefined || //Req
            datum["agency_url"] === undefined || //Req
            datum["agency_timezone"] === undefined //Req
        ) {
            console.error("Error: GTFS agencies datum structure invalid at index " + i + ".");
            return false;
        }
        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_agency", "readwrite");
        var store = tx.objectStore("gtfs_agency");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.put(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        return Promise.all(proms);
    });
}

export function getAgencyByAgencyId(pkg, provider, agencyId) {
    if (!pkg || !provider) {
        console.error("Error: getAgencyByAgencyId missing pkg, provider, agencyId parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_agency", "readonly");
            var store = tx.objectStore("gtfs_agency");
            var request = store.get([pkg, provider, agencyId]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

//Required: trip_id (string), start_time (string), end_time (string), headway_secs (number)
//Cond/Optional: exact_times (number)
export function putFrequencies(pkg, provider, data) {
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putFrequencies missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        if (datum["trip_id"] === undefined || //Req
            datum["start_time"] === undefined || //Req
            datum["end_time"] === undefined || //Req
            datum["headway_secs"] === undefined //Req
        ) {
            console.error("Error: GTFS frequencies datum structure invalid at index " + i + ".");
            return false;
        }

        datum["headway_secs"] = parseInt(datum["headway_secs"]);
        if (datum["exact_times"] !== undefined) {
            datum["exact_times"] = parseInt(datum["exact_times"]);
        }

        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_frequencies", "readwrite");
        var store = tx.objectStore("gtfs_frequencies");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.put(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        return Promise.all(proms);
    });
}

export function getFrequencyByTripId(pkg, provider, tripId) {
    if (!pkg || !provider) {
        console.error("Error: getFrequencyByTripId missing pkg, provider, tripId parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_frequencies", "readonly");
            var store = tx.objectStore("gtfs_frequencies");
            var request = store.get([pkg, provider, tripId]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}

//Required: service_id (string), date (number), exception_type (number)
export function putCalendarDates(pkg, provider, data) {
    if (!pkg || !provider || !data || !data.length) {
        console.error("Error: putCalendarDates missing pkg, provider or data parameter.");
        return false;
    }
    var i;
    var datum;
    for (i = 0; i < data.length; i++) {
        datum = data[i];
        //All Required
        if (datum["service_id"] === undefined ||
            datum["date"] === undefined ||
            datum["exception_type"] === undefined
        ) {
            console.error("Error: GTFS calendar dates datum structure invalid at index " + i + ".");
            return false;
        }

        datum["date"] = parseInt(datum["date"]);
        datum["exception_type"] = parseInt(datum["exception_type"]);

        datum["package"] = pkg;
        datum["provider"] = provider;
    }
    return dbPromise.then(function (db) {
        var tx = db.transaction("gtfs_calendar_dates", "readwrite");
        var store = tx.objectStore("gtfs_calendar_dates");
        var proms = [];
        data.forEach(value => {
            proms.push(new Promise((resolve, reject) => {
                var req = store.put(value);
                req.onsuccess = resolve;
                req.onerror = reject;
            }));
        });
        return Promise.all(proms);
    });
}

export function getCalendarDateByServiceIdAndDate(pkg, provider, serviceId, date) {
    if (!pkg || !provider) {
        console.error("Error: getCalendarDateByServiceIdAndDate missing pkg, provider, serviceId, date parameter.");
        return false;
    }
    return new Promise((resolve, reject) => {
        dbPromise.then(function (db) {
            var tx = db.transaction("gtfs_calendar_dates", "readonly");
            var store = tx.objectStore("gtfs_calendar_dates");
            var request = store.get([pkg, provider, serviceId, date]);
            request.onsuccess = function () {
                resolve(request.result ? request.result.data : false);
            };
            request.onerror = reject;
        });
    });
}