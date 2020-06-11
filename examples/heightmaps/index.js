const threelet = new Threelet({
    canvas: document.getElementById("canvas"),
});
threelet.setup('mod-controls', THREE.OrbitControls);
threelet.setup('mod-stats', window.Stats, {panelType: 1});

const { scene, render } = threelet;
render(); // first time

const group = new THREE.Group();
group.rotation.x = - Math.PI/2;
scene.add(group);

const ioToken = 'pk.eyJ1IjoiamRldmVsIiwiYSI6ImNqemFwaGJoZjAyc3MzbXA1OGNuODBxa2EifQ.7M__SgfWZGJuEiSqbBXdoQ';
const tgeo = new ThreeGeo({
    // tokenMapbox: '********', // <---- set your Mapbox API token here
    tokenMapbox: ioToken,
});

const isDebug = 0;
if (isDebug) {
    tgeo.tokenMapbox = 'zzzz';
    tgeo.setApiVector(`../geo-viewer/cache/eiger/custom-terrain-vector`);
    tgeo.setApiRgb(`../geo-viewer/cache/eiger/custom-terrain-rgb`);
    tgeo.setApiSatellite(`../geo-viewer/cache/eiger/custom-satellite`);
}

const createTextSprite = (text, color) => Threelet.Utils.createCanvasSprite(
    Threelet.Utils.createCanvasFromText(text, 256, 64, {
        tfg: color,
        fontSize: '36px',
        fontFamily: 'Times',
    }));

const demToObjects = (demUri, demTile, proj) => {
    const { obj, offset, size } = ThreeGeo.Utils.bboxToWireframe(
        ThreeGeo.Utils.tileToBbox(demTile), proj, {
            offsetZ: - 0.1,
            color: 0xcc00cc,
        });
    // console.log('offset, size:', offset, size);

    let _demUri = demUri;
    if (isDebug) {
        const [tx, ty, tz] = demTile;
        _demUri = `../geo-viewer/cache/eiger/custom-terrain-rgb-${tz}-${tx}-${ty}.png`;
    }

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(size[0], size[1]),
        new THREE.MeshBasicMaterial({
            map: new THREE.TextureLoader().load(_demUri),
            // side: THREE.DoubleSide,
        }));
    plane.position.set(...offset);

    const sp = createTextSprite(`${demTile.join('-')}`, '#f0f');
    sp.position.set(offset[0], offset[1], offset[2] + 0.1);

    return {
        wireframe: obj,
        plane: plane,
        sprite: sp,
    };
};

const msg = document.getElementById('msg');
const appendText = (el, text) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    el.appendChild(div);
};

if (tgeo.tokenMapbox === ioToken && window.location.origin !== 'https://w3reality.github.io') {
    const warning = 'Please set your Mapbox API token in the ThreeGeo constructor.';
    appendText(msg, warning);
    throw warning;
}

// params: [lat, lng], terrain's radius (km), zoom resolution, callbacks
// Beware the value of radius; radius > 5.0 (km) could trigger huge number of tile API calls!!
const origin = [46.5763, 7.9904];
const radius = 5.0;
const { proj, bbox, unitsPerMeter } = tgeo.getProjection(origin, radius);
// console.log('proj:', proj);
// console.log('unitsPerMeter:', unitsPerMeter);

const srcDemUris = {};

appendText(msg, `---- ROI ----`);
appendText(msg, `lat lng: (${origin[0]}, ${origin[1]})`);
appendText(msg, `radius: ${radius} [km]`);
appendText(msg, `units per km: ${unitsPerMeter * 1000}`);
appendText(msg, `bbox (w, s, e, n): (${bbox.map(q => q.toFixed(4)).join(', ')})`);
appendText(msg, `---- Terrain Composition ----`);

const appendCompositionInfo = (el, tile, srcDemTile) => {
    const div = document.createElement('div');
    el.appendChild(div);

    let span = document.createElement('span');
    span.style.color = '#00ffffff';
    span.appendChild(document.createTextNode(`tile ${tile.join('-')}`));
    div.appendChild(span);

    div.appendChild(document.createTextNode(' using '));

    span = document.createElement('span');
    span.style.color = '#ff00ffff';
    span.appendChild(document.createTextNode(`DEM ${srcDemTile.join('-')}`));
    div.appendChild(span);
};

(async () => {
    const terrain = await tgeo.getTerrainRgb(origin, radius, 12);
    group.add(terrain);

    terrain.children.forEach(mesh => {
        mesh.material.wireframe = true;

        console.log('rgb DEM mesh:', mesh);
        console.log('userData:', mesh.userData);

        //======== how to access the post-processed heightmap
        const array = mesh.geometry.attributes.position.array;
        console.log('array.length:', array.length); // 3x128x128 (+ deltaSeams)

        //======== how to visualize constituent tiles of the terrain
        const tile = mesh.userData.threeGeo.tile;
        const { obj, offset } = ThreeGeo.Utils.bboxToWireframe(
            ThreeGeo.Utils.tileToBbox(tile), proj, {offsetZ: - 0.05});

        const sp = createTextSprite(`${tile.join('-')}`, '#0ff');
        sp.position.set(offset[0], offset[1], offset[2] + 0.05);
        group.add(obj, sp);

        //======== how to access src DEM being used (grand-parental tile)
        // ref - https://www.mapbox.com/help/access-elevation-data/#mapbox-terrain-rgb
        const { tile: srcDemTile, uri: srcDemUri } =
            mesh.userData.threeGeo.srcDem;
        appendCompositionInfo(msg, tile, srcDemTile);

        if (! srcDemUris[srcDemUri]) {
            srcDemUris[srcDemUri] = true;

            const { wireframe, plane, sprite } =
                demToObjects(srcDemUri, srcDemTile, proj);
            group.add(wireframe, plane, sprite);
        }
    });

    render();
})();
