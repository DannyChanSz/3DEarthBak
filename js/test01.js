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

renderer = new THREE.CanvasRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);

// the renderer's canvas domElement is added to the body
document.body.appendChild(renderer.domElement);

var particle, material;

function particleRender(context) {
    context.beginPath();
    context.arc(0, 0, 1, 0, 2*Math.PI, true);
    //context.fillStyle = getRandomColor();
    context.fill();
};

material = new THREE.ParticleCanvasMaterial( {
    // color: 0xffffff,
    // color: "0xff0000",
    // color:    new THREE.Color(getRandomColor()),
    color:    '0xffffff',
    program: particleRender
});
// make the particle
particle = new THREE.Particle(material);

// give it a random x and y position between -500 and 500
particle.position.x = 200;
particle.position.y = 0;
particle.position.z = 100;

// scale it up a bit
particle.scale.x = particle.scale.y = 10;

// add it to the scene
scene.add(particle);

// and to the array of particles.
//particles.push(particle);

renderer.render(scene, camera);