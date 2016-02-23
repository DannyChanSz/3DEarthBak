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

renderer = new THREE.WebGLRenderer({});
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
function generateSprite() {

    var canvas = document.createElement( 'canvas' );
    canvas.width = 16;
    canvas.height = 16;

    var context = canvas.getContext( '2d' );
    var gradient = context.createRadialGradient( canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2 );
    gradient.addColorStop( 0, 'rgba(255,255,255,1)' );
    gradient.addColorStop( 0.2, 'rgba(0,255,255,1)' );
    gradient.addColorStop( 0.4, 'rgba(0,0,64,1)' );
    gradient.addColorStop( 1, 'rgba(0,0,0,1)' );

    context.fillStyle = gradient;
    context.fillRect( 0, 0, canvas.width, canvas.height );

    return canvas;

}
material = new THREE.ParticleBasicMaterial( {
    map: new THREE.Texture( generateSprite() ),
    blending: THREE.AdditiveBlending
});
// make the particle
particle = new THREE.Sprite(material);

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