import * from 'script_hals';
import * from 'script_location';
import * from 'script_map';
import * from 'script_options';
import * from 'script_zip';

//tokens
mapboxgl.accessToken = 'pk.eyJ1IjoidGFsa3RvYnJlbnQiLCJhIjoiY2tubzRrMGppMTRhMjJycGIwZXV0emQ5aSJ9.aNwVGU_EwJ_On8B_8SaJ4g';
//end tokens
document.addEventListener("DOMContentLoaded", ()=> {
    var history = {
        map: document.getElementById("map"),
        zip: document.getElementById("zip"),
        hals: document.getElementById("hals"),
        locations: document.getElementById("locations"),
        who: document.getElementById("who"),
        detail: document.getElementById("where-detail"),
        fill: document.getElementById("fill"),
        loader: document.getElementById("loader")
    };
    document.getElementById("hals").addEventListener("change", ()=> {
        history.selectHal();
    });
    document.getElementById("zip").addEventListener("input", ()=> {
        history.validZip();
    });
});


