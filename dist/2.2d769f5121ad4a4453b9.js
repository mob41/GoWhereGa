(window.webpackJsonp=window.webpackJsonp||[]).push([[2],{22:function(e,t,r){"use strict";r.r(t),function(e){r.d(t,"onload",(function(){return d}));var n=r(15),o=r(2),s=r(18),a=r(7),i=r(5),c=r(10),u=r(14);function d(){return n.register("db.kmbeta.ml",!0),n.register("etav3.kmb.hk",!1),n.register("search.kmb.hk",!1),c.registerProvider(TransitType.BUS,"KMB",{default:"KMB",en:"KMB",zh:"九巴"},new h),!0}var h=function(){this.fetchDatabase=function(t,r){e.ajax({url:"https://db.kmbeta.ml/kmbeta_db.json",cache:!0,dataType:"json",success:function(e){t(e)},error:function(e){r(e)}})},this.isDatabaseUpdateNeeded=function(t,r,n){e.ajax({url:"https://db.kmbeta.ml/kmbeta_db-version.json",cache:!1,dataType:"json",success:function(e){var r,o;try{r=parseInt(e.version),o=parseInt(n)}catch(e){console.error("Error: Could not parse kmbeta_db last updated time or cached version! Forcing to be no update"),t(!1)}console.log("lu: "+r+" v: "+o),console.log("r: "+r>o),t(r>o)},error:function(e){console.error("Error: Could not check kmbeta_db update!"),t(!1)}})},this.getStopIndex=function(e,t,r){var n=this.getRoute(e),o=this.getStop(t);if(!n||!o)return-1;if(r<0||r>=n.paths.length)return-1;for(var s=n.paths[r],a=0;a<s.length;a++){t=s[a];if(o.stopId===t)return a}return-1},this.fetchEta=function(t,r,n){var c=a.getRouteById(n.routeId),d=i.getStopById(n.stopId),h=this.getRouteById(c.routeName);if(!h)return console.error("Error: Could not get KMB reference by database route name. Aborting fetch ETA."),void r();if(h.paths.length!==c.paths.length||n.selectedPath>=h.paths.length)return console.error("Error: KMB reference database mismatch. Aborting fetch ETA."),void r();var l=s.b(c,d,n.selectedPath),p=h.paths[n.selectedPath][l];if(!this.getStopById(p))return console.error("Error: Could not get CTBNWFB reference stop. Aborting fetch ETA."),void r();var f="http://etav3.kmb.hk/?action=geteta&lang="+("zh"===o.getLocale()?"tc":"en")+"&route="+h.routeId+"&bound="+(n.selectedPath+1)+"&stop="+p+"&stop_seq="+(l+1);u.b((function(){e.ajax({url:f,dataType:"json",cache:!1,success:function(e){var r,o,s=[];if(e&&e.response)for(r=e&&e.generated?new Date(e.generated):new Date,o=0;o<e.response.length;o++){var a=e.response[o],i={},c=a.t.toLowerCase();if(!(c.includes("城巴")||c.includes("新巴")||c.includes("kmb")||c.includes("ctb"))){i.type=TransitType.BUS,i.provider="KMB",i.isLive=!c.includes("scheduled")&&!c.includes("預定班次"),i.isOutdated=!1;var u=parseInt(c.substring(0,2)),d=parseInt(c.substring(3,5)),h=new Date(e.updated);h.setHours(u),h.setMinutes(d),u!=u||d!=d?i.msg=a.t:(i.hasTime=!0,i.time=h.getTime()),i.serverTime=r.getTime(),i.features=!1,s.push(i)}}t({options:n,schedules:s})},error:function(e){r(n,e)}})}))}}}.call(this,r(0))}}]);
//# sourceMappingURL=2.2d769f5121ad4a4453b9.js.map