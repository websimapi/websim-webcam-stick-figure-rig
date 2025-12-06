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

// --- Stick Figure Class ---
class StickFigure {
    constructor(scene) {
        this.scene = scene;
        this.joints = {};
        this.bones = [];
        this.root = new THREE.Group();
        this.scene.add(this.root);

        // --- Materials ---
        this.jointMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x111111,
        });

        this.boneMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });
        
        this.headMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xeeeeee,
            roughness: 0.2,
            metalness: 0.1,
            clearcoat: 0.8
        });

        this.eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.0,
            metalness: 0.5
        });

        this.initGeometry();
        this.initHandGeometry();
    }

    initGeometry() {
        // 1. Create Joints (Spheres)
        const sphereGeo = new THREE.SphereGeometry(1, 16, 16); // Base size 1, will scale
        
        // Create 33 landmarks
        for (let i = 0; i < 33; i++) {
            const mesh = new THREE.Mesh(sphereGeo, this.jointMaterial);
            mesh.scale.setScalar(0.04); // Default size
            mesh.visible = false;
            this.root.add(mesh);
            this.joints[i] = mesh;
        }

        // 2. Head Construction (Procedural Mesh)
        this.headGroup = new THREE.Group();
        this.root.add(this.headGroup);
        
        // Head Shape (Capsule-like using Sphere + Scale)
        const headMesh = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.1, 0.15, 4, 8),
            this.headMaterial
        );
        this.headGroup.add(headMesh);
        
        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.025, 12, 12);
        const leftEye = new THREE.Mesh(eyeGeo, this.eyeMaterial);
        leftEye.position.set(-0.04, 0.02, 0.08); // Offset from head center
        const rightEye = new THREE.Mesh(eyeGeo, this.eyeMaterial);
        rightEye.position.set(0.04, 0.02, 0.08);
        
        this.headGroup.add(leftEye);
        this.headGroup.add(rightEye);
        
        this.headGroup.visible = false;

        // 3. Define Body Segments with Specific Geometry
        // Format: [start, end, radiusTop, radiusBottom, type]
        const boneDefs = [
            // Torso (Thicker)
            { start: 11, end: 12, r1: 0.06, r2: 0.06 }, // Shoulders
            { start: 23, end: 24, r1: 0.07, r2: 0.07 }, // Hips
            { start: 11, end: 23, r1: 0.05, r2: 0.06 }, // L Side
            { start: 12, end: 24, r1: 0.05, r2: 0.06 }, // R Side
            
            // Arms (Tapered)
            { start: 11, end: 13, r1: 0.05, r2: 0.04 }, // L Upper Arm
            { start: 13, end: 15, r1: 0.035, r2: 0.03 }, // L Lower Arm
            { start: 12, end: 14, r1: 0.05, r2: 0.04 }, // R Upper Arm
            { start: 14, end: 16, r1: 0.035, r2: 0.03 }, // R Lower Arm
            
            // Legs (Thicker Tapered)
            { start: 23, end: 25, r1: 0.07, r2: 0.055 }, // L Thigh
            { start: 25, end: 27, r1: 0.05, r2: 0.04 }, // L Shin
            { start: 24, end: 26, r1: 0.07, r2: 0.055 }, // R Thigh
            { start: 26, end: 28, r1: 0.05, r2: 0.04 }, // R Shin

            // Hands/Feet (Simple connections)
            { start: 15, end: 17, r1: 0.02, r2: 0.02 }, // L Pinky Base
            { start: 15, end: 19, r1: 0.02, r2: 0.02 }, // L Index Base
            { start: 16, end: 18, r1: 0.02, r2: 0.02 }, // R Pinky Base
            { start: 16, end: 20, r1: 0.02, r2: 0.02 }, // R Index Base
            
            { start: 27, end: 29, r1: 0.03, r2: 0.03 }, // L Heel
            { start: 27, end: 31, r1: 0.03, r2: 0.03 }, // L Toe
            { start: 28, end: 30, r1: 0.03, r2: 0.03 }, // R Heel
            { start: 28, end: 32, r1: 0.03, r2: 0.03 }, // R Toe
        ];

        this.bones = [];

        boneDefs.forEach(def => {
            // Create Cylinder: radiusTop, radiusBottom, height=1, segments=8
            // We rotate X 90 degrees so cylinder aligns with Z axis. 
            // Default Cylinder is Y-up. Top is +Y. Bottom is -Y.
            // Rotated X 90: Top becomes +Z, Bottom becomes -Z.
            // So r1 (start) should be Bottom (-Z), r2 (end) should be Top (+Z).
            // Actually, wait: 
            // If I put mesh at midpoint and LookAt(end). 
            // Local +Z points to End.
            // So the face that is at +Z (the "Top" of the original cylinder) should be r2.
            // So RadiusTop = r2 (End Radius). RadiusBottom = r1 (Start Radius).
            
            const geo = new THREE.CylinderGeometry(def.r2, def.r1, 1, 12);
            geo.rotateX(Math.PI / 2); // Rotate so +Y becomes +Z (Forward)

            const mesh = new THREE.Mesh(geo, this.boneMaterial);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.visible = false;
            
            this.root.add(mesh);
            this.bones.push({ 
                mesh, 
                start: def.start, 
                end: def.end,
                r1: def.r1,
                r2: def.r2
            });
        });
    }

    initHandGeometry() {
        // Create Left and Right Hand Groups
        this.leftHand = this.createHandGroup();
        this.rightHand = this.createHandGroup();
        this.root.add(this.leftHand);
        this.root.add(this.rightHand);
    }

    createHandGroup() {
        const group = new THREE.Group();
        group.visible = false;
        group.userData = { joints: [], bones: [] };

        const jointGeo = new THREE.SphereGeometry(0.015, 8, 8);
        
        // 21 Joints per hand
        for (let i = 0; i < 21; i++) {
            const mesh = new THREE.Mesh(jointGeo, this.jointMaterial);
            group.add(mesh);
            group.userData.joints.push(mesh);
        }

        // Bones connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],     // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],     // Index
            [0, 9], [9, 10], [10, 11], [11, 12],// Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20]  // Pinky
        ];

        const boneMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });

        connections.forEach(([start, end]) => {
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), boneMat);
            mesh.geometry.rotateX(Math.PI / 2); // Align to Z
            group.add(mesh);
            group.userData.bones.push({ mesh, start, end });
        });

        return group;
    }

    update(worldLandmarks, normalizedLandmarks, leftHandLandmarks, rightHandLandmarks) {
        const scale = 1.0; 

        // 1. Update Root Position FIRST to ensure world matrices are valid for lookAt
        if (normalizedLandmarks) {
            const leftShoulder = normalizedLandmarks[11];
            const rightShoulder = normalizedLandmarks[12];

            if (leftShoulder && rightShoulder) {
                // Distance estimation
                const dx = leftShoulder.x - rightShoulder.x;
                const dy = leftShoulder.y - rightShoulder.y;
                const width = Math.sqrt(dx*dx + dy*dy);
                
                // Tuned depth factor
                const estimatedDepth = (0.3 / (width + 0.001)); 
                const targetZ = Math.max(0.5, Math.min(estimatedDepth * 3, 8)) - 4;

                // X position
                const centerX = (leftShoulder.x + rightShoulder.x) / 2;
                const targetX = -(centerX - 0.5) * 5;

                // Smooth interpolation
                this.root.position.x += (targetX - this.root.position.x) * 0.1;
                this.root.position.z += (targetZ - this.root.position.z) * 0.1;
                
                this.root.position.y = 1.0;

                // Force update matrix so children calculations use current frame's transform
                this.root.updateMatrixWorld();
            }
        }

        if(worldLandmarks) {
            // 2. Update Body Joints
            for (let i = 0; i < worldLandmarks.length; i++) {
                // Skip hands (17-22) in body rig if we have full hand tracking, 
                // but we keep them for the wrist attachment logic.
                const lm = worldLandmarks[i];
                if (this.joints[i]) {
                    this.joints[i].position.set(-lm.x * scale, -lm.y * scale, -lm.z * scale);
                    this.joints[i].visible = lm.visibility > 0.5;
                    
                    // Dynamic scaling for joints
                    if ([11,12,23,24].includes(i)) this.joints[i].scale.setScalar(0.07);
                    else if ([13,14,25,26].includes(i)) this.joints[i].scale.setScalar(0.06);
                    else this.joints[i].scale.setScalar(0.04);
                }
            }

            // Update Hands
            this.updateHandInstance(this.leftHand, leftHandLandmarks, worldLandmarks, 15, 19, 17, true);
            this.updateHandInstance(this.rightHand, rightHandLandmarks, worldLandmarks, 16, 20, 18, false);
        }

        // 3. Update Bones
        const target = new THREE.Vector3();
        this.bones.forEach(bone => {
            const j1 = this.joints[bone.start];
            const j2 = this.joints[bone.end];

            if (j1.visible && j2.visible) {
                bone.mesh.visible = true;
                const p1 = j1.position;
                const p2 = j2.position;
                const dist = p1.distanceTo(p2);

                if (dist > 0.001) {
                    // Position at midpoint (Local)
                    bone.mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
                    
                    // Scale length only
                    bone.mesh.scale.set(1, 1, dist);
                    
                    // Orient: lookAt requires World Space target. 
                    // Since p2 is local to root, we must convert it to world space.
                    target.copy(p2).applyMatrix4(this.root.matrixWorld);
                    bone.mesh.lookAt(target);
                }
            } else {
                bone.mesh.visible = false;
            }
        });

        // 4. Update Head
        const nose = this.joints[0];
        const leftEar = this.joints[7];
        const rightEar = this.joints[8];

        if (nose && nose.visible) {
            this.headGroup.visible = true;
            this.headGroup.position.copy(nose.position);
            
            if (leftEar.visible && rightEar.visible) {
                this.headGroup.lookAt(camera.position); 
            } else {
                this.headGroup.lookAt(camera.position);
            }
            
        } else {
            this.headGroup.visible = false;
        }
    }

    updateHandInstance(handGroup, handLandmarks, bodyLandmarks, wristIdx, indexIdx, pinkyIdx, isLeft) {
        if (!handLandmarks || !bodyLandmarks[wristIdx] || bodyLandmarks[wristIdx].visibility < 0.5) {
            handGroup.visible = false;
            return;
        }

        handGroup.visible = true;

        // 1. Position: Attach to Wrist
        // Note: Body landmarks are already inverted (-x, -y, -z) in update(), so we match that transform here
        const wristPos = new THREE.Vector3(
            -bodyLandmarks[wristIdx].x,
            -bodyLandmarks[wristIdx].y,
            -bodyLandmarks[wristIdx].z
        );

        // We need to operate in local space of the stick figure root
        // Since handGroup is child of root, and we set position relative to root
        handGroup.position.copy(wristPos);

        // 2. Orientation & Scale Logic
        // We use the body landmarks (Wrist, IndexKnuckle, PinkyKnuckle) to determine the world rotation
        // because handLandmarks are normalized and lack absolute world rotation.
        
        const indexPos = new THREE.Vector3(
            -bodyLandmarks[indexIdx].x,
            -bodyLandmarks[indexIdx].y,
            -bodyLandmarks[indexIdx].z
        );
        
        const pinkyPos = new THREE.Vector3(
            -bodyLandmarks[pinkyIdx].x,
            -bodyLandmarks[pinkyIdx].y,
            -bodyLandmarks[pinkyIdx].z
        );

        // Calculate Scale: Match 3D distance of Wrist->Index
        const worldScale = wristPos.distanceTo(indexPos);
        // Distance in normalized hand landmarks (Wrist=0 to IndexMCP=5)
        const lmWrist = handLandmarks[0];
        const lmIndex = handLandmarks[5];
        const lmPinky = handLandmarks[17];

        const dHand = Math.sqrt(
            Math.pow(lmIndex.x - lmWrist.x, 2) +
            Math.pow(lmIndex.y - lmWrist.y, 2) +
            Math.pow(lmIndex.z - lmWrist.z, 2)
        );
        
        const scale = (worldScale / (dHand + 1e-5)) * 1.0; // Multiplier to tune size if needed
        handGroup.scale.setScalar(scale);

        // Calculate Rotation
        // Construct Basis from Pose World Landmarks
        const vPoseFwd = new THREE.Vector3().subVectors(indexPos, wristPos).normalize();
        const vPoseSide = new THREE.Vector3().subVectors(pinkyPos, wristPos).normalize();
        const vPoseUp = new THREE.Vector3().crossVectors(vPoseFwd, vPoseSide).normalize();
        const vPoseSideCorrected = new THREE.Vector3().crossVectors(vPoseUp, vPoseFwd).normalize();
        const mPose = new THREE.Matrix4().makeBasis(vPoseFwd, vPoseUp, vPoseSideCorrected);

        // Construct Basis from Hand Landmarks (Local)
        // Hand system: x=horizontal, y=vertical, z=depth. 
        // We need vectors corresponding to the same physical axes.
        const vHandFwd = new THREE.Vector3(lmIndex.x - lmWrist.x, lmIndex.y - lmWrist.y, lmIndex.z - lmWrist.z).normalize();
        const vHandSide = new THREE.Vector3(lmPinky.x - lmWrist.x, lmPinky.y - lmWrist.y, lmPinky.z - lmWrist.z).normalize();
        const vHandUp = new THREE.Vector3().crossVectors(vHandFwd, vHandSide).normalize();
        const vHandSideCorrected = new THREE.Vector3().crossVectors(vHandUp, vHandFwd).normalize();
        const mHand = new THREE.Matrix4().makeBasis(vHandFwd, vHandUp, vHandSideCorrected);
        
        // Rotation R = mPose * inverse(mHand)
        const mRot = mPose.multiply(mHand.invert());
        handGroup.quaternion.setFromRotationMatrix(mRot);
        
        // Apply mirror for one hand if needed? 
        // MediaPipe coords are usually consistent, but let's see. 
        // Actually, just mapping the positions locally works because we computed the rotation to align the basis.

        // 3. Update Joint Positions (Relative to Wrist)
        handGroup.userData.joints.forEach((mesh, i) => {
            const lm = handLandmarks[i];
            // Position relative to wrist (index 0)
            // Note: We don't invert axes here because we built the rotation matrix mHand from these axes directly.
            // We just place them as is relative to 0.
            mesh.position.set(
                (lm.x - lmWrist.x), 
                (lm.y - lmWrist.y), 
                (lm.z - lmWrist.z)
            );
        });

        // 4. Update Bones
        handGroup.userData.bones.forEach(bone => {
            const p1 = handGroup.userData.joints[bone.start].position;
            const p2 = handGroup.userData.joints[bone.end].position;
            
            bone.mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
            const dist = p1.distanceTo(p2);
            bone.mesh.scale.set(1, 1, dist);
            bone.mesh.lookAt(p2); // lookAt works in local space if parent is transformed? No.
            // Mesh lookAt operates in world space usually, BUT if we are adding to a group, 
            // and we want it to look at a local point...
            // ThreeJS Object3D.lookAt() assumes the target is in WORLD space.
            // Since p2 is local, we must convert p2 to world for lookAt to work correctly.
            
            const worldTarget = p2.clone().applyMatrix4(handGroup.matrixWorld);
            bone.mesh.lookAt(worldTarget);
        });
    }
}

const stickFigure = new StickFigure(scene);

// --- MediaPipe Logic ---
log("Configuring Neural Network...");

async function setupMediaPipe() {
    try {
        if (!window.Holistic) {
            throw new Error("MediaPipe Holistic script not loaded.");
        }

        const holistic = new window.Holistic({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
            }
        });

        holistic.setOptions({
            modelComplexity: 1, 
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        holistic.onResults(onResults);

        // Setup Camera
        log("Accessing Camera...");
        const videoElement = document.getElementsByClassName('input_video')[0];

        const cameraUtils = new window.Camera(videoElement, {
            onFrame: async () => {
                await holistic.send({image: videoElement});
            },
            width: 640,
            height: 480
        });

        log("Starting Camera Stream...");
        await cameraUtils.start();
        log("Tracking Active! (Hands + Body)", false); // Success!

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

    // Update 3D Model
    stickFigure.update(
        results.poseWorldLandmarks, 
        results.poseLandmarks,
        results.leftHandLandmarks,
        results.rightHandLandmarks
    );
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