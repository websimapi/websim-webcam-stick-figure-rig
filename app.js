import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Logger Utility ---
const loadingEl = document.getElementById('loading');
function log(msg, isError = false) {
    console.log(`[App] ${msg}`);
    if (loadingEl) {
        loadingEl.innerHTML = msg + (isError ? '<br><br>Please reload or check camera permissions.' : '');
        if(isError) loadingEl.style.color = '#ff6b6b';
    }
}

log("Starting application...");

// --- Configuration ---
const CONFIG = {
    camera: { width: 640, height: 480 },
    stickFigure: {
        color: 0x00ffcc,
        jointSize: 0.05,
        boneThickness: 0.03,
        headSize: 0.15
    }
};

// --- Three.js Setup ---
log("Initializing 3D Environment...");
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
// Add some fog for depth perception
scene.fog = new THREE.FogExp2(0x1a1a1a, 0.1);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 3); // Initial view

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(2, 4, 3);
scene.add(dirLight);

// Floor
const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
scene.add(gridHelper);

// Texture Loader
const textureLoader = new THREE.TextureLoader();
const faceTexture = textureLoader.load('./face.png');

// --- Stick Figure Class ---
class StickFigure {
    constructor(scene) {
        this.scene = scene;
        this.joints = {};
        this.bones = [];
        this.root = new THREE.Group();
        this.scene.add(this.root);

        this.material = new THREE.MeshStandardMaterial({ 
            color: CONFIG.stickFigure.color,
            roughness: 0.4,
            metalness: 0.3
        });

        this.boneMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5
        });

        // Initialize pool of meshes
        this.initGeometry();
    }

    initGeometry() {
        // We need 33 joints roughly, mostly hidden, but let's make visible ones
        // MediaPipe Pose has 33 landmarks.
        const sphereGeo = new THREE.SphereGeometry(CONFIG.stickFigure.jointSize, 16, 16);

        // Create joints
        for (let i = 0; i < 33; i++) {
            const mesh = new THREE.Mesh(sphereGeo, this.material);
            mesh.visible = false; // Start hidden
            this.root.add(mesh);
            this.joints[i] = mesh;
        }

        // Special Head
        this.head = new THREE.Mesh(
            new THREE.PlaneGeometry(CONFIG.stickFigure.headSize * 2.5, CONFIG.stickFigure.headSize * 2.5),
            new THREE.MeshBasicMaterial({ 
                map: faceTexture, 
                transparent: true, 
                side: THREE.DoubleSide 
            })
        );
        this.root.add(this.head);

        // Connections (Bones)
        // Indices based on MediaPipe Pose connections
        this.connections = [
            [11, 12], // Shoulders
            [11, 13], [13, 15], // Left Arm
            [12, 14], [14, 16], // Right Arm
            [11, 23], [12, 24], // Torso sides
            [23, 24], // Hips
            [23, 25], [25, 27], // Left Leg
            [24, 26], [26, 28], // Right Leg
            [27, 29], [27, 31], // Left Foot (Heel, Toe)
            [28, 30], [28, 32], // Right Foot
            [15, 17], [15, 19], [15, 21], // Left Hand
            [16, 18], [16, 20], [16, 22]  // Right Hand
        ];

        const cylinderGeo = new THREE.CylinderGeometry(CONFIG.stickFigure.boneThickness, CONFIG.stickFigure.boneThickness, 1, 8);
        cylinderGeo.rotateX(Math.PI / 2); // Orient along Z initially for lookAt logic or just use vector math

        this.boneMeshes = [];
        this.connections.forEach((pair) => {
            const mesh = new THREE.Mesh(cylinderGeo, this.boneMaterial);
            mesh.visible = false;
            this.root.add(mesh);
            this.boneMeshes.push({ mesh, start: pair[0], end: pair[1] });
        });
    }

    update(worldLandmarks, normalizedLandmarks) {
        // 1. Position Joints
        // MediaPipe World coordinates: Y is down? No, usually Y is up in WorldLandmarks but inverted in raw. 
        // Let's check: +Y in MP World is usually down. +Z is usually 'into' the scene?
        // We might need to invert Y and Z to match Three.js (Y up, -Z forward)

        // Scaling factor to make the figure reasonable size in the scene
        const scale = 1.0; 

        // Update joint positions
        if(worldLandmarks) {
            for (let i = 0; i < worldLandmarks.length; i++) {
                const lm = worldLandmarks[i];
                if (this.joints[i]) {
                    // Mapping MP coordinates to Three.js
                    // MP: x (left/right), y (up/down), z (depth)
                    // We flip Y to match standard 3D world up
                    this.joints[i].position.set(-lm.x * scale, -lm.y * scale, -lm.z * scale);
                    this.joints[i].visible = lm.visibility > 0.5;
                }
            }
        }

        // Update Bones
        this.boneMeshes.forEach(bone => {
            const startJoint = this.joints[bone.start];
            const endJoint = this.joints[bone.end];

            if (startJoint.visible && endJoint.visible) {
                bone.mesh.visible = true;
                const p1 = startJoint.position;
                const p2 = endJoint.position;

                // Position at midpoint
                bone.mesh.position.copy(p1).add(p2).multiplyScalar(0.5);

                // Scale length
                const dist = p1.distanceTo(p2);
                bone.mesh.scale.set(1, 1, dist);

                // Orientation
                bone.mesh.lookAt(p2);
            } else {
                bone.mesh.visible = false;
            }
        });

        // Update Head (Pin to nose 0, or avg of ears/eyes)
        if (this.joints[0] && this.joints[0].visible) {
            this.head.position.copy(this.joints[0].position);
            // Face camera
            this.head.lookAt(camera.position);
            this.head.visible = true;
        } else {
            this.head.visible = false;
        }

        // Global Position Logic (Move figure in world based on user distance)
        // We use normalized landmarks for this as 'z' in world landmarks is relative to hips.
        // We want absolute world position.
        // Strategy: 
        // 1. Calculate approximate distance of user from camera based on shoulder width in screen space.
        // 2. Map screen x/y to world x/y.

        if (normalizedLandmarks) {
            const leftShoulder = normalizedLandmarks[11];
            const rightShoulder = normalizedLandmarks[12];

            if (leftShoulder && rightShoulder) {
                // Calculate 2D shoulder width
                const dx = leftShoulder.x - rightShoulder.x;
                const dy = leftShoulder.y - rightShoulder.y;
                const width = Math.sqrt(dx*dx + dy*dy);

                // Heuristic: Width of 0.5 (half screen) = 1 meter away? 
                // As width gets smaller, user is further away.
                // distance ~= constant / width
                const estimatedDepth = (0.3 / (width + 0.001)); 

                // Smooth transition (Lerp)
                const targetZ = Math.max(0.5, Math.min(estimatedDepth * 3, 8)) - 4; // Offset to start near origin

                // X position: Map 0.5 (center) to 0. 
                const centerX = (leftShoulder.x + rightShoulder.x) / 2;
                const targetX = -(centerX - 0.5) * 5; // Multiplier for sensitivity

                // Apply to root group with smoothing
                this.root.position.x += (targetX - this.root.position.x) * 0.1;
                this.root.position.z += (targetZ - this.root.position.z) * 0.1;

                // Adjust height based on distance to keep feet on floor roughly
                // This is tricky without floor detection, but let's just clamp the lowest point to 0 if possible
                // For now, simple fixed offset
                this.root.position.y = 1.0; 
            }
        }
    }
}

const stickFigure = new StickFigure(scene);

// --- MediaPipe Logic ---
log("Configuring Neural Network...");

async function setupMediaPipe() {
    try {
        if (!window.Pose) {
            throw new Error("MediaPipe Pose script not loaded.");
        }

        const pose = new window.Pose({
            locateFile: (file) => {
                // IMPORTANT: Use CDN to avoid local file 404s
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });

        pose.setOptions({
            modelComplexity: 1, // 0=Lite, 1=Full, 2=Heavy. 1 is good balance.
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onResults);

        // Setup Camera
        log("Accessing Camera...");
        const videoElement = document.getElementsByClassName('input_video')[0];

        const cameraUtils = new window.Camera(videoElement, {
            onFrame: async () => {
                await pose.send({image: videoElement});
            },
            width: 640,
            height: 480
        });

        log("Starting Camera Stream...");
        await cameraUtils.start();
        log("Tracking Active!", false); // Success!

        // Hide loader after a moment
        setTimeout(() => {
            if(loadingEl && loadingEl.innerText.includes("Active")) {
                loadingEl.style.display = 'none';
            }
        }, 1000);

    } catch (e) {
        log(`Error initializing: ${e.message}`, true);
        console.error(e);
    }
}

function onResults(results) {
    if (!results.poseLandmarks) return;

    // Draw debug view (optional)
    // const canvasCtx = document.querySelector('.output_canvas').getContext('2d');
    // ... drawing code if needed ...

    // Update 3D Model
    stickFigure.update(results.poseWorldLandmarks, results.poseLandmarks);
}

// --- Window Resize Handling ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Debug Controls ---
document.getElementById('toggle-debug').addEventListener('click', () => {
    const video = document.querySelector('.input_video');
    if (video.style.display === 'none') {
        video.style.display = 'block';
        video.style.position = 'absolute';
        video.style.bottom = '20px';
        video.style.right = '20px';
        video.style.width = '160px';
        video.style.zIndex = '100';
    } else {
        video.style.display = 'none';
    }
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Start
animate();
setupMediaPipe();