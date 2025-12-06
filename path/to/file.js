// ... existing code ...

        this.updateHandInstance(this.leftHand, leftHandLandmarks, worldLandmarks, 15, 19, 17, true);
        this.updateHandInstance(this.rightHand, rightHandLandmarks, worldLandmarks, 16, 20, 18, false);
    }
}

updateHandInstance(handGroup, handLandmarks, bodyLandmarks, wristIdx, indexIdx, pinkyIdx, isLeft) {
    // 1. Safety & Visibility Checks
    const wrist = bodyLandmarks[wristIdx];
    const index = bodyLandmarks[indexIdx];
    const pinky = bodyLandmarks[pinkyIdx];
    
    if (!handLandmarks || !wrist || wrist.visibility < 0.5 || !index || !pinky) {
        handGroup.visible = false;
        return;
    }
    handGroup.visible = true;

    // 2. Define World Reference Frame (from Body Pose)
    // We use the Body World Landmarks to position and orient the entire hand group.
    // This ensures the hand stays attached to the arm properly.
    const pWrist = new THREE.Vector3(-wrist.x, -wrist.y, -wrist.z);
    const pIndex = new THREE.Vector3(-index.x, -index.y, -index.z);
    const pPinky = new THREE.Vector3(-pinky.x, -pinky.y, -pinky.z);

    // Calculate Body-derived Basis vectors
    // Main Axis: Wrist -> Index
    const vBodyDir = new THREE.Vector3().subVectors(pIndex, pWrist);
    const bodyScale = vBodyDir.length();
    vBodyDir.normalize();

    // Secondary Axis: Wrist -> Pinky (defines the plane of the hand)
    const vBodySide = new THREE.Vector3().subVectors(pPinky, pWrist).normalize();
    
    // Construct Orthogonal Basis: Forward (Dir), Up (Normal to Palm), Side
    const vBodyUp = new THREE.Vector3().crossVectors(vBodyDir, vBodySide).normalize();
    const vBodySideOrtho = new THREE.Vector3().crossVectors(vBodyUp, vBodyDir).normalize();
    
    const mBody = new THREE.Matrix4().makeBasis(vBodyDir, vBodyUp, vBodySideOrtho);
    const qBody = new THREE.Quaternion().setFromRotationMatrix(mBody);

    // 3. Apply Transform to Hand Group
    handGroup.position.copy(pWrist);
    handGroup.quaternion.copy(qBody);
    
    // 4. Map Normalized Hand Landmarks to Local Group Space
    // Hand Landmarks are relative to the crop, not world. We need to normalize them.
    const lmWrist = handLandmarks[0];
    const lmIndex = handLandmarks[5];
    const lmPinky = handLandmarks[17];

    // Calculate Hand LM Basis
    const vLmDir = new THREE.Vector3(lmIndex.x - lmWrist.x, lmIndex.y - lmWrist.y, lmIndex.z - lmWrist.z);
    const distLm = vLmDir.length(); // Scale reference
    vLmDir.normalize();

    const vLmSide = new THREE.Vector3(lmPinky.x - lmWrist.x, lmPinky.y - lmWrist.y, lmPinky.z - lmWrist.z).normalize();
    const vLmUp = new THREE.Vector3().crossVectors(vLmDir, vLmSide).normalize();
    const vLmSideOrtho = new THREE.Vector3().crossVectors(vLmUp, vLmDir).normalize();
    
    const mLm = new THREE.Matrix4().makeBasis(vLmDir, vLmUp, vLmSideOrtho);
    const qLm = new THREE.Quaternion().setFromRotationMatrix(mLm);

    // Calculate Scale Factor (Body Size / LM Size)
    const scale = bodyScale / (distLm || 0.001); // Prevent div/0
    handGroup.scale.setScalar(scale);

    // Correction Rotation: We need to rotate LM vectors so that LM-Forward aligns with Group-Forward (X-axis)
    const qCorrection = qLm.clone().invert();

    // 5. Update Internal Joints
    handGroup.userData.joints.forEach((mesh, i) => {
        const lm = handLandmarks[i];
        
        // Vector from Wrist (in LM space)
        const vRaw = new THREE.Vector3(lm.x - lmWrist.x, lm.y - lmWrist.y, lm.z - lmWrist.z);
        
        // Rotate to align with Group Axes (X=Forward)
        vRaw.applyQuaternion(qCorrection);
        
        // Set Position (Scale is handled by parent group)
        mesh.position.copy(vRaw);
    });

    // 6. Update Internal Bones
    handGroup.userData.bones.forEach(bone => {
         const j1 = handGroup.userData.joints[bone.start];
         const j2 = handGroup.userData.joints[bone.end];
         
         // Midpoint
         bone.mesh.position.copy(j1.position).add(j2.position).multiplyScalar(0.5);
         
         // Scale Length
         const vBone = new THREE.Vector3().subVectors(j2.position, j1.position);
         const len = vBone.length();
         bone.mesh.scale.set(1, 1, len);
         
         // Orientation
         // Align cylinder (local Y) or customized Z to vector
         // Our bone geometry is rotated to Z-axis in init, so we align (0,0,1) to vBone
         bone.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), vBone.normalize());
    });
}

const stickFigure = new StickFigure(scene);
// ... existing code ...