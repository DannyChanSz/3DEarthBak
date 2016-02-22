/**
 * Created by szp_s on 2016/2/22.
 */
// the main three.js components
var camera, scene, renderer,

// to keep track of the mouse position
    mouseX = 0, mouseY = 0,

// an array to store our particles in
    particles = [];

init();

function init() {
    // Camera params :
    camera = new THREE.PerspectiveCamera(80, window.innerWidth/window.innerHeight, 1, 4000);
    camera.position.z = 1000;

    // the scene contains all the 3D object data
    scene = new THREE.Scene();
    scene.add(camera);

    // and the CanvasRenderer figures out what the
    // stuff in the secne looks like and draws it!
    renderer = new THREE.CanvasRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // the renderer's canvas domElement is added to the body
    document.body.appendChild(renderer.domElement);

    makeParticles();

    // add the mouse move listener
    document.addEventListener('mousemove', onMouseMove, false);

    // render 30 times a second (should also look at requestAnimationFrame)
    setInterval(update, 1000/30);

}

function update() {
    updateParticles();

    // and render the scene from the perspective of the camera
    renderer.render(scene, camera);
}

// creates a random field of Particle object
function makeParticles() {
    var particle, material;

    // we're gonna move from z position -1000 (far away)
    // to 1000 (where the camera is) and add a random particle
    // at every pos
    for (var zpos = -1000; zpos < 1000; zpos += 20) {
        // we make a particle material and pass through the
        // color and custom particle render function we defined
        material = new THREE.ParticleCanvasMaterial( {
            // color: 0xffffff,
            // color: "0xff0000",
            // color:    new THREE.Color(getRandomColor()),
            color:    getRandomColor(),
            program: particleRender
        });
        // make the particle
        particle = new THREE.Particle(material);

        // give it a random x and y position between -500 and 500
        particle.position.x = Math.random() * 1000 - 500;
        particle.position.y = Math.random() * 1000 - 500;

        particle.position.z = zpos;

        // scale it up a bit
        particle.scale.x = particle.scale.y = 10;

        // add it to the scene
        scene.add(particle);

        // and to the array of particles.
        particles.push(particle);
    }
}

// there isn't a built in circle particle renderer
// so we have to define our own.
function particleRender(context) {
    context.beginPath();
    context.arc(0, 0, 1, 0, 2*Math.PI, true);
    //context.fillStyle = getRandomColor();
    context.fill();
};

// moves all the particles dependent on mouse position
function updateParticles() {
    // iterate through every particle
    for (var i = 0; i < particles.length; i++) {
        particle = particles[i];

        // and move it forward dependent on the mouseY position.
        particle.position.z += mouseY * 0.1;

        // if the particle is too close move it to the back
        if (particle.position.z > 1000)
            particle.position.z -= 2000;
    }
}

// called when the mouse moves
function onMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
}

function getRandomColor() {
    var r = 255*Math.random()|0,
        g = 255*Math.random()|0,
        b = 255*Math.random()|0;
    //return 'rgb(' + r + ',' + g + ',' + b + ')';
    //return '0x' + parseInt(r, 16) + parseInt(g, 16) + parseInt(b, 16);
    return '0xffffff';
}