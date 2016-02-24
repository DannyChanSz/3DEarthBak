/**
 * Created by shenzp on 2016/2/23.
 */
var camera, scene, renderer,

// to keep track of the mouse position
    mouseX = 0, mouseY = 0,

// an array to store our particles in
    particles = [];

scene = new THREE.Scene();

//camera = new THREE.PerspectiveCamera( 12, window.innerWidth / window.innerHeight, 1, 20000 );
camera = new THREE.PerspectiveCamera( 12, window.innerWidth / window.innerHeight, 1, 20000 );
camera.position.z = 1400;
camera.position.y = 0;
camera.position.x = 100;
camera.lookAt(scene.width/2, scene.height/2);
scene.add( camera );

//camera = new THREE.PerspectiveCamera(80, window.innerWidth/window.innerHeight, 1, 4000);
//camera.position.z = 1000;
//scene.add(camera);

renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);

// the renderer's canvas domElement is added to the body
document.body.appendChild(renderer.domElement);

// 创建粒子geometry
var particleCount = 2000,
    particles = new THREE.Geometry(),
    pMaterial =
        new THREE.ParticleBasicMaterial({
            color: 0xFFFFFF,
            size: 10,
            map: THREE.ImageUtils.loadTexture('images/start.png'),
            blending: THREE.AdditiveBlending,
            transparent: true
        });
// 依次创建单个粒子
for(var p = 0; p < particleCount; p++) {
// 粒子范围在-250到250之间
    var pX = Math.random() * 500 - 250,
        pY = Math.random() * 500 - 250,
        pZ = Math.random() * 500 - 250,
        particle = new THREE.Vector3(pX, pY, pZ);

// 将粒子加入粒子geometry
    particles.vertices.push(particle);
}
// 创建粒子系统
var particleSystem =
    new THREE.ParticleSystem(
        particles,
        pMaterial);

particleSystem.sortParticles = true;

// 将粒子系统加入场景
scene.add(particleSystem);

// and to the array of particles.
//particles.push(particle);

renderer.render(scene, camera);