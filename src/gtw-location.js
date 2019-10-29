//GTW Location Manager

import * as Map from './gtw-map';

const LOCATION_MANAGER_CONVENTION_KEY = "openeta-location-convention";

const CONVENTION_ASK_EVERYTIME = "CONVENTION_ASK_EVERYTIME";
const CONVENTION_CUSTOM_LOCATION = "CONVENTION_CUSTOM_LOCATION";
const CONVENTION_ASK_LOCATION_ACCESS = "CONVENTION_ASK_LOCATION_ACCESS";
const CONVENTION_DIRECT_LOCATION_ACCESS = "CONVENTION_DIRECT_LOCATION_ACCESS";
const ERROR_NOT_SUPPORTED = 0;
const ERROR_NO_ACCESS = 1;

export var watchId = 0;

export var currentPosition = { lat: 22.2952296, lng: 114.1766577 };

export function getConvention() {
    var localStorage = window.localStorage;
    if (!localStorage || !localStorage.getItem(LOCATION_MANAGER_CONVENTION_KEY)) {
        return CONVENTION_ASK_EVERYTIME;
    }
    return localStorage.getItem(LOCATION_MANAGER_CONVENTION_KEY);
}

export function setConvention(convention) {
    var localStorage = window.localStorage;
    if (!localStorage) {
        return;
    }
    localStorage.setItem(LOCATION_MANAGER_CONVENTION_KEY, convention);
}

export function requestLocationAccess(successFunc = function () { }, errorFunc = function () { }) {
    if (!navigator.geolocation) {
        errorFunc(ERROR_NOT_SUPPORTED);
        return;
    }

    var global = this;

    navigator.geolocation.getCurrentPosition(function (position) {
        global.currentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        global.currentLocationMarker = new google.maps.Marker({
            position: global.currentPosition,
            map: map,
            icon: "img/human.png"
        });

        map.setCenter(global.currentPosition);
        map.setZoom(16);

        global.watchId = navigator.geolocation.watchPosition(
            function (p) { global.onPositionChangeSuccess(p) },
            function (e) { global.onPositionChangeError(e) },
            {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 0
            }
        );

        successFunc(global.currentPosition);
    }, function () {
        errorFunc(ERROR_NO_ACCESS);
    }, { timeout: 5000 });
}

export function getCurrentPosition() {
    return currentPosition;
}

export function onPositionChangeSuccess(position) {
    currentPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };
    //currentLocationMarker.setPosition(exports.currentPosition);
}

export function onPositionChangeError(error) {
    alert("TODO: Handle Position error!")
}