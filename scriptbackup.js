
mapboxgl.accessToken = 'pk.eyJ1IjoidGFsa3RvYnJlbnQiLCJhIjoiY2tubzRrMGppMTRhMjJycGIwZXV0emQ5aSJ9.aNwVGU_EwJ_On8B_8SaJ4g';

socket = new WebSocket("ws://127.0.0.1:6789/");
socket.onmessage = function (event) {
    data = JSON.parse(event.data);
    if (data['locations']) {
        history._changeZip(data.zip, data)
    }
    else if (data['coords']) {
        history.mapZoomer(data['coords'])
    }
    else {}
};


document.addEventListener("DOMContentLoaded", ()=> {

    socket =

    var history = {
        map: document.getElementById("map"),
        zip: document.getElementById("zip"),
        hals: document.getElementById("hals"),
        locations: document.getElementById("locations"),
        who: document.getElementById("who"),
        detail: document.getElementById("where-detail"),
        summary: document.getElementById("where"),
        fill: document.getElementById("fill"),
        loader: document.getElementById("loader"),
        payment: document.getElementById("payment"),
        initial: true,

        templates: {},


//        templates

//        setTemplates: function() {
//            let location = this.templateClone(this.locationT);
//            this.headerLineT = location.querySelector("#headerline");
//            this.addressLineT = location.querySelector("#addressline");
//            this.phoneT = location.querySelector("#phone");
//            this.dayT = location.querySelector('#day');
//            this.openT = location.querySelector('#open');
//            this.closedT = location.querySelector('#closed');
//            this.optionT = location.querySelector('#option');
//        },

        fedexRoute: "http://localhost:1111/api/locations/",
        validateRoute: "http://localhost:1111/api/validate/zip/",


        mapStyle: function() {
            let style = localStorage.getItem('style')
            if (style && style.length) {
                style = JSON.parse(style);
                this._mapStyle = style;
                return style;
            }
            else {
                return false;
            }
        },

        saveJSON: async function(key, json) {
            localStorage.setItem(key, JSON.stringify(await json));
        },

        getJSON: function(key) {
            return JSON.parse(localStorage.getItem(key));
        },

        markerOn: window.getComputedStyle(document.getElementById("marker"), ':after').getPropertyValue('color'),
        markerOff: window.getComputedStyle(document.getElementById("marker"), ':before').getPropertyValue('color'),

        viewLocation: function(open = true) {
            if (open) {
                this.who.hidden = false;
                this.locations.hidden = false;
                this.detail.open = true;
                this.payment.open = true;
            }
            else {
                this.who.hidden = true;
                this.locations.hidden = true;
                this.detail.open = false;
                this.payment.open = false;
            }
        },
        changeSelection: function(option = null, old = this.state.selection) {
            if (option && old && option === old) {
                return false;
            }
            this.toggleLocation(option, old);
            if (!option) {
                this.viewLocation(false);
                this.mapZoomer(this.state.zip.coords, true);
                this.fill.selected = true;
            }
            else {
                this.viewLocation(true);
                this.mapZoomer(option.data.coords);
                option.selected = true;
            }
            this.toggleMarker(option ? option.marker : null, old ? old.marker : null);
            this.state.selection = option;
        },
        toggleLocation: function(option = null, old = null) {
            if (old) {
                old.location.hidden = true;
            }
            if (option) {
                if (option.location) {
                    option.location.hidden = false;
                }
                else {
                    this.locationBuilder(option);
                }
            }
            return option;
        },
        getSelection: function() {
            let hal_id = this.hals.value.split(String.fromCharCode(9), 1)[0];
            return this.state[hal_id];
        },
        _changeZip: async function(zip, json, initial = false) {
            this.state[zip] = {
                coords: json.coords,
                zip: zip
            };
            this.state.zip = this.state[zip];
            if (!initial) {
                this.changeSelection();
            }
            this.loadedMap();
            this.optionsBuilder(zip, json.locations).then((options) => {
                this.state[zip].options = options;
            });
            return json;
        },
        _beforeZip: function(zip) {
            this.viewLocation(false);
            this.loadingMap();
            this.zip.placeholder = zip;
            this.hideOptions(this.state.zip);
        }

        _afterZip: async function() {
            this.changeSelection();
            this.loadedMap();
        }

        _alreadyZip: async function(zip) {
            this.showOptions(this.state[zip]);
            this.state.zip = this.state[zip];
        }

        changeZip: async function(zip = this.zip.value) {
            if (zip === this.state.zip.zip) {
                return false;
            }
            let coords = await this.validateZip(zip);
            if (!coords) {
                return false;
            }
            this.viewLocation(false);
            this.loadingMap();
            this.zip.placeholder = zip;
            this.hideOptions(this.state.zip);
            if (!this.map.map) {
                var json = await this.mapAndFetch(zip, coords);
                return this._changeZip(zip, json, true);
            }
            else if (this.state[zip]) {
                this.showOptions(this.state[zip]);
                this.state.zip = this.state[zip];
                this.changeSelection();
                this.loadedMap();
                return true;
            }
            else {
                var json = await this.locationsFetch(zip);
                return this._changeZip(zip, json);
            }
        },

        changeZip: async function(zip = this.zip.value) {
            if (zip === this.state.zip.zip) {
                return false;
            }
            let coords = await this.validateZip(zip);
            if (!coords) {
                return false;
            }
            this.viewLocation(false);
            this.loadingMap();
            this.zip.placeholder = zip;
            this.hideOptions(this.state.zip);
            if (!this.map.map) {
                var json = await this.mapAndFetch(zip, coords);
                return this._changeZip(zip, json, true);
            }
            else if (this.state[zip]) {
                this.showOptions(this.state[zip]);
                this.state.zip = this.state[zip];
                this.changeSelection();
                this.loadedMap();
                return true;
            }
            else {
                var json = await this.locationsFetch(zip);
                return this._changeZip(zip, json);
            }
        },



        state: {
            zip: {zip: "", options: []},
            selection: null,
        },

        hideOptions: async function(zip) {
            zip.options.forEach((element)=> {
                element.hidden = true
            });
        },

        showOptions: async function(zip) {
            zip.options.forEach((element)=> {
                element.hidden = false;
            });
        },

//        optionsChange: async function(zip, old) {
//            if (old) {
//                this.hideOptions(old);
//            };
//            if (this.state[zip]) {
//                this.showOptions(zip);
//            }
//            else {
//                this.locationsFetch(zip).then((json) => {
//                    this.state[zip] = {
//                        coords: json.coords
//                    };
//                    this.optionsBuilder(zip, json.locations).then((options) => {
//                        this.state[zip].options = options;
//                    });
//                });
//            };
//        },

        loadedMap: async () => {
            this.loader.hidden = true;
            this.map.style.visibility = 'visible';
            this.hals.hidden = false;
        },

        loadingMap: function() {
            this.map.hidden = false;
            this.map.style.visibility = 'hidden';
            this.loader.hidden = false;
            this.hals.hidden = true;
        },

        templateClone: function(node, selector, text = null) {
            if (this.templates[selector]) {
                var cloner = this.templates[selector];
            }
            else {
                var cloner = node.querySelector(selector)
                this.templates[selector] = cloner;
            }
            let cloned = cloner.content.cloneNode(true);
            if (text) {
                cloned.querySelector(".inner").textContent = text;
            }
            return cloned;
        },
        mapLoader: function(coords = null) {
            this.map.map = new mapboxgl.Map({
                container: 'map', // container ID
                style: this.mapStyle() || 'mapbox://styles/mapbox/streets-v11?optimize=true', // style URL
                center: coords || [-98.35, 39.50],// starting position [lng, lat]
                zoom: coords ? 10 : 20, // starting zoom
                pitchWithRotate: false,
                doubleClickZoom: false,
                touchPitch: false,
                optimizeForTerrain: false,
                renderWorldCopies: false,
                boxZoom: false,
                keyboard: false
            });
//            this.map.map.on('resize', this.loadedMap);
            this.map.map.on('load', async () => {
                let nav = new mapboxgl.NavigationControl();
                nav._container.style.marginTop = '50px';
                this.map.map.addControl(nav, 'top-right');
                this.map.map.setPadding({top: this.detail.offsetHeight});
                if (!this._mapStyle) {
                    this.saveJSON('style', this.map.map.getStyle());
                }
            });

//            return this.map.map.getStyle();
        },
        mapZoomer: async function(coords = null, reset = false) {
            if (this.map.map) {
                this.map.map.resize();
                this.map.map.setCenter(coords);
                if (!reset) {
                    this.map.map.setPadding({left: this.locations.offsetWidth, bottom: this.who.offsetHeight, top: this.detail.offsetHeight});
                    this.map.map.setZoom(15);
                    this.map.map._logoControl._container.style.marginLeft = (this.locations.offsetWidth + 5).toString() + 'px';
                    this.map.map._logoControl._container.style.marginBottom = (this.who.offsetHeight + 5).toString() + 'px';
                    this.map.map._controlPositions['bottom-right'].style.marginBottom = this.who.offsetHeight.toString() + 'px';
                }
                else {
                    this.map.map.setZoom(10);
                    this.map.map.setPadding({left: 0, bottom: 0, top: this.detail.offsetHeight});
                    this.map.map._logoControl._container.style.marginLeft = '5px';
                    this.map.map._logoControl._container.style.marginBottom = '5px';
                    this.map.map._controlPositions['bottom-right'].style.marginBottom = '0px';
                }
            }
            else {
                this.mapLoader(coords);
//                .then((style) => {
//                    localStorage.setItem('style', JSON.stringify(style));
//                });
            }
        },
        validateZip: function(zip) {
            if (this.zip.checkValidity()) {
                if (this.state[zip]) {
                    return this.state[zip].coords;
                }
                else {
                    return fetch(this.validateRoute + zip).then((res) => {
                        if (res.ok) {
                            return res.json()
                        }
                        else {
                            return false
                        }
                    });
                }
            }
            else {
                return false;
            }
        },
        mapMarker: async function(coords, option) {
            let marker = new mapboxgl.Marker({color: this.markerOff}).setLngLat(coords)
                .setPopup(new mapboxgl.Popup({className: 'popup', closeButton: false}).setText(option.text))
                .addTo(this.map.map);
            let marker_dom = marker.getElement();
            option.marker = marker;
            marker_dom.addEventListener('mouseenter', ()=> {marker.togglePopup();});
            marker_dom.addEventListener('mouseleave', ()=> {marker.togglePopup();});
            marker_dom.addEventListener('click', ()=> {
                this.changeSelection(option);
                option.marker.togglePopup();
                if (option.className !== this.state.zip.zip) {
                    option.hidden = false;
                    this.state.zip.options.push(option);
                }
            });
            return marker;
        },
//        https://stackoverflow.com/questions/39458201/understanding-javascript-promise-object
        locationsFetch: function(zip) {
            let already = localStorage.getItem(zip);
            if (already && already.length) {
                return JSON.parse(already);
            }
            return fetch(this.fedexRoute + zip).then((response) => {
                this.saveJSON(zip, response.clone().json());
                return response.json();
            })
        },

        mapAndFetch: async function(zip, coords = null) {

            let map = new Promise((res, rej) => {
                if (!this.map.map) {
                    this.mapLoader(coords);
                }
                if (this.map.map) {
                    this.map.map.once('load', () => {
                        res(this.map.map);
                    });
                } else {
                    rej(null);
                }
            });

            let hals = new Promise((res, rej) => {
                let json = this.locationsFetch(zip);
                if (json) {
                    res(json);
                }
                else {
                    rej(null);
                }
            });

    /*
            https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
    */
            let array = await Promise.all([map, hals]);
            return array[1];
        },



        optionsBuilder: async function(zip, locations) {
            let options = [];
            let fragment = new DocumentFragment();
            for (let [id, loc] of Object.entries(locations)) {
                let option = document.createElement('OPTION');
                option.id = id;
                option.className = zip;
                option.value = id + String.fromCharCode(9) + loc.value;
                option.text = [loc.inside || loc.name.join(", "), loc.street.join(", "), [loc.state, loc.postal].join(' ')].join(', ')
                option.data = loc;
                this.state[id] = option;
                this.mapMarker(loc.coords, option).then((marker) => {
                    this.state[id].marker = marker;
                })
                options.push(option);
            };
            fragment.append(...options)
            this.hals.appendChild(fragment);
            return options;
        },
        locationBuilder: function(option) {
            let data = option.data
            let hal = this.templateClone(document, '#location', data.name[0]);
            hal.id = option.id;
            for (let line of data.name.slice(1)) {
                hal.querySelector("header").appendChild(this.templateClone(hal, "#headerline", line));
            }
            let address = hal.querySelector("dl");
            let street = data.street
            street.push(data.city + ', ' + data.state + ' ' + data.postal)
            for (let line of street) {
                address.querySelector("#addressline").insertAdjacentElement('beforebegin',
                    this.templateClone(address, '#addressline', line).querySelector('.inner')
                );
            }
            if (data.phone) {
                let phone = this.templateClone(address, '#phone', data.phone);
                phone.querySelector('a').href += data.phone;
                address.appendChild(phone);
            }
            let table = hal.querySelector("table");
            for (let [day, open, close] of data.hours) {
                let tr = this.templateClone(address, '#day', day).querySelector('tr');
                if (open) {
                    let td = this.templateClone(tr, '#open', open);
                    tr.appendChild(td);

                    td = this.templateClone(tr, '#open', close);
                    tr.appendChild(td);
                }
                else {
                    let td = this.templateClone(tr, '#closed');
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }
            this.locations.appendChild(hal);
            option.location = locations.lastElementChild;
            option.location.addEventListener('click', (e) => {
                this.mapZoomer(option.data.coords);
                option.marker.togglePopup();
            });
        },
//        zipState: function() {
//            if (this.zip.checkValidity()) {
//                this.summary.classList.add('on');
//                var zip = this.zip.value
//                if (zip !== this.zip.current) {
//                    this.loadingMap();
//                    this.selectionState(null, true);
//                    old = this.state.zip;
//                    this.state.zip = zip;
//                    this.optionsChange(zip, old);
//                }
//            }
//        },
//        selectionState: async function(option = null, reset = false) {
//            if (option) {
//                option.selected = true;
//                this.detail.open = true;
//            }
//            else if (reset) {
//                this.fill.selected = true;
//                this.detail.open = false;
//            }
//            else {
//                hal_id = this.hals.value.split(String.fromCharCode(9), 1)[0];
//                option = this.state[hal_id];
//                this.detail.open = true;
//            }
//            this.locationChange(option);
//            if (this.state.selection) {
//                this.state.selection.location.hidden = true;
//            }
//
//            this.toggleMarker(option ? option.marker : null, this.state.selection ? this.state.selection.marker : null);
//            this.state.selection = option;
//        },
        toggleMarker: async function(marker = null, old = null) {
//        https://stackoverflow.com/a/66068188
            if (old) {
                let oldish = old.getElement();
                oldish.querySelectorAll('svg g[fill="' + old._color + '"]')[0]
                    .setAttribute("fill", this.markerOff);
                old._color = this.markerOff;
            }
            if (marker) {
                let newish = marker.getElement();
                newish.querySelectorAll('svg g[fill="' + marker._color + '"]')[0]
                    .setAttribute("fill", this.markerOn);
                marker._color = this.markerOn;
            }
            return marker;
        }
//        locationChange: function(option = null) {
//            if (option) {
//                this.who.hidden = false;
//                this.locations.hidden = false;
//
//                if (!option.location) {
//                    this.locationBuilder(option).then((location) => {
//                        option.location = location;
//                        this.mapZoomer(option.data.coords);
//                    });
//                }
//                else {
//                    option.location.hidden = false;
//                    this.mapZoomer(option.data.coords);
//                }
//            }
//            else {
//                this.who.hidden = true;
//                this.locations.hidden = true;
//            }
//        }
    };

    //    load mapbox
//    const script = document.createElement('script');
//    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.2.0/mapbox-gl.js'; // URL for the third-party library being loaded.
//    script.onload = function() {
//        mapboxgl.accessToken = 'pk.eyJ1IjoidGFsa3RvYnJlbnQiLCJhIjoiY2tubzRrMGppMTRhMjJycGIwZXV0emQ5aSJ9.aNwVGU_EwJ_On8B_8SaJ4g';
//    };
//    document.querySelector('head').appendChild(script);
    history.hals.addEventListener("change", (e)=> {
        if (e.isTrusted) {
            history.changeSelection(history.getSelection());
        }
    });
    history.zip.addEventListener("input", ()=> {
        history.changeZip();
    });
    history.zip.addEventListener("click", (event)=> {
        event.stopPropagation();
    });
    history.hals.addEventListener("click", (event)=> {
        event.stopPropagation();
    });
    history.detail.addEventListener("click", (event) => {
        if (history.map.hidden && !history.detail.open) {
            event.preventDefault();
            history.zip.reportValidity();
            return;
        }
        if (!history.state.selection && !history.detail.open) {
            event.preventDefault();
            history.hals.reportValidity();
        }
    });
    history.detail.addEventListener("toggle", (event) => {
        if (event.isTrusted) {
            if (!history.detail.open) {
                history.viewLocation(false);
                history.mapZoomer(history.state.zip.coords, true);
            }
            else if (history.state.selection) {
                history.viewLocation();
                history.mapZoomer(history.state.selection.data.coords);
            }
            else {
            }

        }
    });
});


//    let hals = e.target
//    if (!("history" in hals)) {
//        hals.history = {};
//        hals.prev = hals.firstChild;
//        document.getElementById("who").hidden = false
//    }
//    hals.prev.hidden = true
//    if (hals.value in hals.history) {
//        hals.history[hals.value].hidden = false
//        hals.prev = hals.history[hals.value]
//    }
//    else {
//        hal = document.getElementById("location").content.cloneNode(true);
//        hal.id = hals.value;
//        hals.prev = hal
//        address = hal.querySelector("dl");
//        hal.querySelector("dt").innerHTML = "hhhh";
//        for (line of ["hhh", "gggg"]) {
//            dd = document.createElement("DD");
//            dd.innerHTML = line;
//            address.appendChild(dd);
//        }
//        open = hal.querySelectorAll("tr");
//        days = open[0];
//        times = open[1];
//        for (let [day, hours] of Object.entries({"mon": "6-7"})) {
//            th = document.createElement("TH");
//            th.innerHTML = day;
//            days.appendChild(th);
//
//            td = document.createElement("TD");
//            td.innerHTML = hours;
//            times.appendChild(td);
//        }
//        locations = document.getElementById("locations");
//        locations.appendChild(hal);
//        hals.history[hals.value] = locations.lastChild;
//    }
//    document.getElementById("where-detail").open = true
//

//    let zip = e.target;
//    let hals = zip.nextSibling.nextSibling;
//    let map = document.getElementById("map");
//    if (zip.checkValidity()) {
//        hals.hidden = false;
//        map.hidden = false;
//        if (!("history" in zip)) {
//            zip.history = {};
//            zip.prev_options = [];
//            zip.prev_text = "";
//        }
//        if (zip.value === zip.prev_text) {
//            return;
//        }
//        zip.prev_options.forEach((element)=> {
//            element.hidden = true
//        });
//        if (zip.value in zip.history) {
//            zip.history[zip.value].forEach((element)=> {
//                element.hidden = false;
//            });
//            zip.prev_options = zip.history[zip.value];
//        }
//        else {
//            options = [];
//            option = document.createElement("OPTION");
//            option.className = zip.value;
//            option.value = "ffff";
//            option.text = "ffffffff";
////            option.data-info = "77777";
//            hals.appendChild(option);
//            options.push(option);
//            zip.history[zip.value] = options;
//       }
//       document.getElementById("where-detail").open = true
//    }




