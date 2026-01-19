// ============================================================
// VOID SUPREMACY 3D - Input Manager
// Handles keyboard, mouse input and hotkeys
// ============================================================

import { TEAMS } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { selectionSystem } from '../systems/SelectionSystem.js';
import { sceneManager } from '../rendering/SceneManager.js';
import { buildMenu } from '../ui/BuildMenu.js';
import { commandPanel } from '../ui/CommandPanel.js';

export class InputManager {
    constructor() {
        this.canvas = null;
        this.keysDown = new Set();
        this.isDragging = false;
        this.dragStart = null;
        this.dragEnd = null;
        this.wasBoxSelect = false;
        this.mouseX = 0;
        this.mouseY = 0;

        // Selection box element
        this.selectionBox = null;

        // Double-click detection
        this.lastClickTime = 0;
        this.lastClickEntity = null;
        this.doubleClickThreshold = 300; // ms

        // Edge scrolling
        this.edgeScrollSpeed = 300;
        this.edgeScrollMargin = 20;

        // Camera rotation speed (radians per second)
        this.cameraRotateSpeed = 2;
    }

    init(canvas) {
        console.log('InputManager.init called with canvas:', canvas, canvas?.id);
        this.canvas = canvas;

        // Get selection box element (or create if missing)
        this.selectionBox = document.getElementById('selectionBox');
        if (!this.selectionBox) {
            this.selectionBox = document.createElement('div');
            this.selectionBox.id = 'selectionBox';
            this.selectionBox.style.cssText = `
                position: absolute;
                border: 2px solid #0af;
                background: rgba(0, 170, 255, 0.15);
                pointer-events: none;
                display: none;
                z-index: 50;
                box-shadow: 0 0 10px rgba(0, 170, 255, 0.5), inset 0 0 20px rgba(0, 170, 255, 0.1);
            `;
            document.body.appendChild(this.selectionBox);
            console.log('InputManager: Created selection box element');
        }

        // Keyboard events - store bound handlers for cleanup
        this._onKeyDown = (e) => this.onKeyDown(e);
        this._onKeyUp = (e) => this.onKeyUp(e);
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);

        // Mouse events
        canvas.addEventListener('click', (e) => this.onClick(e));
        canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        canvas.addEventListener('contextmenu', (e) => this.onRightClick(e));
        // Use capture phase to ensure we get events before BabylonJS
        // Using pointer events instead of mouse events to avoid Babylon.js conflicts
        // Store bound handlers for cleanup
        this._onMouseDown = (e) => this.onMouseDown(e);
        this._onMouseUp = (e) => this.onMouseUp(e);
        this._onMouseMove = (e) => this.onMouseMove(e);

        canvas.addEventListener('pointerdown', this._onMouseDown, true);
        canvas.addEventListener('pointerup', this._onMouseUp, true);
        canvas.addEventListener('pointermove', this._onMouseMove, true);

        console.log('InputManager: All event listeners attached to canvas');

        // Prevent default context menu
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // ===== Keyboard Input =====

    onKeyDown(e) {
        this.keysDown.add(e.code);

        // Handle hotkeys
        this.handleHotkey(e);

        eventBus.emit(GameEvents.INPUT_KEY, {
            code: e.code,
            key: e.key,
            down: true,
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
            alt: e.altKey
        });
    }

    onKeyUp(e) {
        this.keysDown.delete(e.code);

        eventBus.emit(GameEvents.INPUT_KEY, {
            code: e.code,
            key: e.key,
            down: false,
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
            alt: e.altKey
        });
    }

    handleHotkey(e) {
        // Number keys 1-2 for build menu tabs, 0-9 for control groups
        if (e.code >= 'Digit0' && e.code <= 'Digit9') {
            const num = parseInt(e.code.replace('Digit', ''));

            // 1 and 2 switch build menu tabs (if not using Ctrl for control groups)
            if (!e.ctrlKey && (num === 1 || num === 2)) {
                buildMenu.handleHotkey(String(num));
                return;
            }

            if (e.ctrlKey) {
                // Ctrl + Number: Set control group
                selectionSystem.setControlGroup(num);
            } else {
                // Number: Select control group
                selectionSystem.selectControlGroup(num, e.shiftKey);
            }
            return;
        }

        // Route hotkeys to CommandPanel when it's visible
        if (commandPanel.isVisible()) {
            if (commandPanel.handleHotkey(e.key)) {
                return;
            }
        }

        // Command hotkeys (when CommandPanel is not visible but units are selected)
        switch (e.code) {
            case 'KeyX':
                // Stop (X key - S is used for camera movement)
                if (selectionSystem.hasSelection()) {
                    selectionSystem.commandStop();
                    eventBus.emit(GameEvents.COMMAND_COMPLETE, {});
                }
                break;

            case 'KeyH':
                // Hold position
                if (selectionSystem.hasSelection()) {
                    selectionSystem.commandHold();
                    eventBus.emit(GameEvents.COMMAND_COMPLETE, {});
                }
                break;

            case 'KeyG':
                // Attack-move mode (G key - A is used for camera movement)
                if (selectionSystem.hasSelection()) {
                    eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, {
                        mode: 'attackMove'
                    });
                }
                break;

            case 'KeyP':
                // Patrol mode (requires click)
                if (selectionSystem.hasSelection()) {
                    eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, {
                        mode: 'patrol'
                    });
                }
                break;

            case 'Escape':
                // Cancel build mode, close build menu, or deselect
                if (buildMenu.isVisible()) {
                    buildMenu.hide();
                } else if (gameState.buildMode) {
                    eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
                } else {
                    selectionSystem.clearSelection();
                }
                break;

            case 'Delete':
                // Cancel selected building construction (if any)
                this.cancelSelectedBuilding();
                break;
        }

        // Building hotkeys (B to toggle build menu)
        if (e.code === 'KeyB') {
            buildMenu.toggle();
        }
    }

    cancelSelectedBuilding() {
        const selectedBuildings = selectionSystem.getSelectedBuildings();
        for (const building of selectedBuildings) {
            if (building.isConstructing) {
                // Refund partial cost
                const refund = building.def.cost * (1 - building.constructionProgress) * 0.5;
                gameState.modifyResource(building.team, 'credits', Math.floor(refund));
                building.die(null);
            }
        }
    }

    // ===== Mouse Input =====

    onClick(e) {
        // Check if we were box-selecting
        if (this.wasBoxSelect) {
            this.wasBoxSelect = false;
            return;
        }

        const entity = sceneManager.pickEntity(e.clientX, e.clientY, gameState.entities);
        const worldPos = sceneManager.getWorldPosition(e.clientX, e.clientY);
        console.log('onClick: worldPos=', worldPos, 'entity=', entity?.type);

        // Handle build mode
        if (gameState.buildMode) {
            if (worldPos) {
                console.log('onClick: calling handleBuildModeClick at', worldPos);
                this.handleBuildModeClick(worldPos);
            } else {
                console.log('onClick: buildMode but worldPos is NULL - raycasting failed!');
            }
            return;
        }

        eventBus.emit(GameEvents.INPUT_CLICK, {
            entity,
            worldPos,
            addToSelection: e.shiftKey,
            screenX: e.clientX,
            screenY: e.clientY
        });
    }

    onDoubleClick(e) {
        const entity = sceneManager.pickEntity(e.clientX, e.clientY, gameState.entities);

        if (entity && entity.team === TEAMS.PLAYER && entity.isUnit) {
            // Select all units of the same type on screen
            this.selectAllOfType(entity.type);
        }
    }

    selectAllOfType(unitType) {
        selectionSystem.clearSelection();

        // Get visible units of the same type
        for (const entity of gameState.entities) {
            if (entity.dead || entity.team !== TEAMS.PLAYER) continue;
            if (!entity.isUnit || entity.type !== unitType) continue;

            // Check if unit is visible on screen
            if (entity.mesh && this.isOnScreen(entity.mesh.position)) {
                gameState.select(entity);
            }
        }

        eventBus.emit(GameEvents.UI_SELECTION_CHANGED, {
            selected: gameState.selectedEntities
        });

        eventBus.emit(GameEvents.UI_ALERT, {
            message: `Selected all ${unitType}s`,
            type: 'info',
            team: TEAMS.PLAYER
        });
    }

    isOnScreen(position) {
        if (!position || !sceneManager.scene || !sceneManager.camera) return false;

        const engine = sceneManager.engine;
        const scene = sceneManager.scene;
        const camera = sceneManager.camera;

        // Project 3D position to screen coordinates
        const screenPos = BABYLON.Vector3.Project(
            position,
            BABYLON.Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
        );

        // Check if within screen bounds
        return screenPos.x >= 0 && screenPos.x <= engine.getRenderWidth() &&
               screenPos.y >= 0 && screenPos.y <= engine.getRenderHeight() &&
               screenPos.z > 0 && screenPos.z < 1;
    }

    handleBuildModeClick(worldPos) {
        if (gameState.buildMode === 'move') {
            selectionSystem.commandMove(worldPos.x, worldPos.z);
            eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
        } else if (gameState.buildMode === 'attackMove') {
            selectionSystem.commandAttackMove(worldPos.x, worldPos.z);
            eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
        } else if (gameState.buildMode === 'patrol') {
            selectionSystem.commandPatrol(worldPos.x, worldPos.z);
            eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
        } else if (gameState.buildMode === 'guard') {
            selectionSystem.commandGuardPosition(worldPos.x, worldPos.z);
            eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
        } else if (gameState.buildMode === 'harvest') {
            // Find ore node at click position
            const oreNode = gameState.oreNodes?.find(node =>
                node && !node.depleted &&
                Math.hypot(node.x - worldPos.x, node.z - worldPos.z) < 15
            );
            if (oreNode) {
                selectionSystem.commandHarvest(oreNode);
            }
            eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
        } else if (gameState.buildMode === 'rallyPoint') {
            // Set rally point for the building stored in gameState
            this.setRallyPoint(worldPos);
            eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
        } else if (gameState.buildMode === 'buildMenu') {
            // 'buildMenu' is not a placeable building - ignore click
            return;
        } else if (gameState.buildMode) {
            // Valid building type - place it
            eventBus.emit(GameEvents.BUILDING_PLACED, {
                type: gameState.buildMode,
                position: worldPos,
                team: TEAMS.PLAYER
            });
        }
    }

    setRallyPoint(worldPos) {
        // Find the selected production building
        const selectedBuilding = gameState.selectedEntities.find(e =>
            e.isBuilding &&
            !e.dead &&
            !e.isConstructing &&
            e.team === TEAMS.PLAYER &&
            e.def?.canBuild?.length > 0
        );

        if (!selectedBuilding) return;

        // Set the rally point
        selectedBuilding.rallyPoint = { x: worldPos.x, z: worldPos.z };

        // Create or update rally marker visual
        this.createRallyMarker(selectedBuilding, worldPos);

        // Emit event
        eventBus.emit(GameEvents.RALLY_POINT_SET, {
            building: selectedBuilding,
            position: { x: worldPos.x, z: worldPos.z }
        });

        // Show feedback
        eventBus.emit(GameEvents.UI_ALERT, {
            message: 'Rally point set',
            type: 'info',
            team: TEAMS.PLAYER
        });
    }

    createRallyMarker(building, worldPos) {
        const scene = sceneManager.scene;
        if (!scene) return;

        // Remove existing marker if any
        if (building.rallyMarker) {
            building.rallyMarker.dispose();
            building.rallyMarker = null;
        }
        if (building.rallyLine) {
            building.rallyLine.dispose();
            building.rallyLine = null;
        }

        // Create flag/beacon marker
        const markerParent = new BABYLON.TransformNode('rallyMarker_' + building.id, scene);
        markerParent.position = new BABYLON.Vector3(worldPos.x, 0, worldPos.z);

        // Flag pole
        const pole = BABYLON.MeshBuilder.CreateCylinder('pole', {
            height: 10,
            diameter: 0.3
        }, scene);
        pole.parent = markerParent;
        pole.position.y = 5;

        const poleMat = new BABYLON.StandardMaterial('poleMat', scene);
        poleMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        poleMat.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        pole.material = poleMat;

        // Flag
        const flag = BABYLON.MeshBuilder.CreatePlane('flag', {
            width: 4,
            height: 3
        }, scene);
        flag.parent = markerParent;
        flag.position.set(2, 8.5, 0);

        const flagMat = new BABYLON.StandardMaterial('flagMat', scene);
        flagMat.diffuseColor = new BABYLON.Color3(0, 0.8, 0.2);
        flagMat.emissiveColor = new BABYLON.Color3(0, 0.4, 0.1);
        flagMat.backFaceCulling = false;
        flag.material = flagMat;

        // Beacon glow at base
        const beacon = BABYLON.MeshBuilder.CreateCylinder('beacon', {
            height: 1,
            diameter: 2
        }, scene);
        beacon.parent = markerParent;
        beacon.position.y = 0.5;

        const beaconMat = new BABYLON.StandardMaterial('beaconMat', scene);
        beaconMat.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
        beaconMat.alpha = 0.6;
        beacon.material = beaconMat;

        building.rallyMarker = markerParent;

        // Create line from building to rally point
        const buildingPos = building.mesh.position;
        const linePoints = [
            new BABYLON.Vector3(buildingPos.x, 2, buildingPos.z),
            new BABYLON.Vector3(worldPos.x, 2, worldPos.z)
        ];

        const line = BABYLON.MeshBuilder.CreateDashedLines('rallyLine', {
            points: linePoints,
            dashSize: 3,
            gapSize: 2,
            dashNb: 30
        }, scene);

        const lineMat = new BABYLON.StandardMaterial('lineMat', scene);
        lineMat.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
        lineMat.disableLighting = true;
        line.material = lineMat;

        building.rallyLine = line;
    }

    onRightClick(e) {
        e.preventDefault();

        const entity = sceneManager.pickEntity(e.clientX, e.clientY, gameState.entities);
        const worldPos = sceneManager.getWorldPosition(e.clientX, e.clientY);

        // Cancel build mode
        if (gameState.buildMode) {
            eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
            return;
        }

        eventBus.emit(GameEvents.INPUT_RIGHT_CLICK, {
            entity,
            worldPos,
            screenX: e.clientX,
            screenY: e.clientY
        });

        // Check if clicked on an ore/crystal node for harvesting
        if (worldPos) {
            const oreNode = this.findOreNodeAt(worldPos.x, worldPos.z);
            if (oreNode && selectionSystem.getSelectedHarvesters().length > 0) {
                selectionSystem.commandHarvest(oreNode);
                return;
            }
        }

        // Default right-click behavior: move or attack
        if (entity && entity.team !== TEAMS.PLAYER) {
            // Enemy - attack
            selectionSystem.commandAttack(entity);
        } else if (worldPos) {
            // Empty space - move
            selectionSystem.commandMove(worldPos.x, worldPos.z);
        }
    }

    findOreNodeAt(x, z) {
        const allNodes = [...gameState.oreNodes, ...gameState.crystalNodes];
        for (const node of allNodes) {
            if (node.depleted) continue;
            const dist = Math.hypot(x - node.x, z - node.z);
            if (dist < node.size + 5) {
                return node;
            }
        }
        return null;
    }

    onMouseDown(e) {
        console.log('MouseDown ENTRY:', e.button, e.target.tagName, e.target.id, 'canvas?', e.target === this.canvas);

        // Only handle canvas clicks
        if (e.target.id !== 'renderCanvas') {
            return;
        }

        console.log('MouseDown ENTRY:', e.button, e.target.id);

        if (e.button === 0) { // Left button
            // Don't start drag if in build mode (placing buildings)
            if (gameState.buildMode) {
                console.log('MouseDown: in build mode, skipping drag');
                return;
            }

            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.dragEnd = { x: e.clientX, y: e.clientY };
            console.log('MouseDown: drag started at', e.clientX, e.clientY, 'selectionBox:', !!this.selectionBox);

            eventBus.emit(GameEvents.INPUT_DRAG_START, {
                screenX: e.clientX,
                screenY: e.clientY
            });
        }
    }

    onMouseUp(e) {
        if (e.button === 0 && this.isDragging) {
            this.isDragging = false;
            this.dragEnd = { x: e.clientX, y: e.clientY };

            // Hide selection box
            this.hideSelectionBox();

            // Only trigger box select if dragged more than a few pixels
            const dx = Math.abs(this.dragEnd.x - this.dragStart.x);
            const dy = Math.abs(this.dragEnd.y - this.dragStart.y);

            if (dx > 5 || dy > 5) {
                this.wasBoxSelect = true;  // Flag to prevent onClick from clearing selection
                const startWorld = sceneManager.getWorldPosition(this.dragStart.x, this.dragStart.y);
                const endWorld = sceneManager.getWorldPosition(this.dragEnd.x, this.dragEnd.y);

                console.log('Drag end - screen coords:', this.dragStart, '->', this.dragEnd);
                console.log('Drag end - world coords:', startWorld, '->', endWorld);

                if (startWorld && endWorld) {
                    eventBus.emit(GameEvents.INPUT_DRAG_END, {
                        startX: startWorld.x,
                        startZ: startWorld.z,
                        endX: endWorld.x,
                        endZ: endWorld.z,
                        addToSelection: e.shiftKey
                    });
                } else {
                    console.warn('Box select failed - could not get world positions!', { startWorld, endWorld });
                }
            }

            // Clear drag start after processing
            this.dragStart = null;
        }
    }

    onMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;

        if (this.isDragging && this.dragStart) {
            this.dragEnd = { x: e.clientX, y: e.clientY };

            // Update selection box visual
            const dx = Math.abs(this.dragEnd.x - this.dragStart.x);
            const dy = Math.abs(this.dragEnd.y - this.dragStart.y);

            if (dx > 5 || dy > 5) {
                console.log('MouseMove: updating selection box, dx:', dx, 'dy:', dy);
                this.updateSelectionBox();
            }
        }
    }

    // ===== Selection Box Visual =====

    updateSelectionBox() {
        if (!this.selectionBox) {
            console.warn('Selection box element not found!');
            return;
        }
        if (!this.dragStart || !this.dragEnd) return;

        const left = Math.min(this.dragStart.x, this.dragEnd.x);
        const top = Math.min(this.dragStart.y, this.dragEnd.y);
        const width = Math.abs(this.dragEnd.x - this.dragStart.x);
        const height = Math.abs(this.dragEnd.y - this.dragStart.y);

        console.log('updateSelectionBox:', left, top, width, height);

        this.selectionBox.style.left = left + 'px';
        this.selectionBox.style.top = top + 'px';
        this.selectionBox.style.width = width + 'px';
        this.selectionBox.style.height = height + 'px';
        this.selectionBox.style.display = 'block';
        this.selectionBox.style.zIndex = '9999'; // Force on top
    }

    hideSelectionBox() {
        if (this.selectionBox) {
            this.selectionBox.style.display = 'none';
        }
    }

    // ===== Edge Scrolling (DISABLED) =====

    updateEdgeScroll(dt) {
        const panAmount = this.edgeScrollSpeed * dt;

        // Arrow keys - Camera rotation only
        if (this.keysDown.has('ArrowLeft')) {
            sceneManager.rotateCamera(this.cameraRotateSpeed * dt);
        }
        if (this.keysDown.has('ArrowRight')) {
            sceneManager.rotateCamera(-this.cameraRotateSpeed * dt);
        }
        // ArrowUp/ArrowDown reserved for future use (pitch/zoom)

        // WASD - Camera-relative movement
        let forward = 0;
        let right = 0;

        if (this.keysDown.has('KeyW')) {
            forward += panAmount;
        }
        if (this.keysDown.has('KeyS')) {
            forward -= panAmount;
        }
        if (this.keysDown.has('KeyA')) {
            right -= panAmount;
        }
        if (this.keysDown.has('KeyD')) {
            right += panAmount;
        }

        // Apply camera-relative movement (WASD)
        if (forward !== 0 || right !== 0) {
            sceneManager.panCameraRelative(forward, right);
        }

        // Q/E - Camera rotation
        if (this.keysDown.has('KeyQ')) {
            sceneManager.rotateCamera(this.cameraRotateSpeed * dt);
        }
        if (this.keysDown.has('KeyE')) {
            sceneManager.rotateCamera(-this.cameraRotateSpeed * dt);
        }
    }

    update(dt) {
        this.updateEdgeScroll(dt);
    }

    isKeyDown(code) {
        return this.keysDown.has(code);
    }

    dispose() {
        this.keysDown.clear();

        // Remove keyboard listeners
        if (this._onKeyDown) {
            window.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
        if (this._onKeyUp) {
            window.removeEventListener('keyup', this._onKeyUp);
            this._onKeyUp = null;
        }

        // Remove canvas listeners
        if (this.canvas) {
            if (this._onMouseDown) {
                this.canvas.removeEventListener('pointerdown', this._onMouseDown, true);
                this._onMouseDown = null;
            }
            if (this._onMouseUp) {
                this.canvas.removeEventListener('pointerup', this._onMouseUp, true);
                this._onMouseUp = null;
            }
            if (this._onMouseMove) {
                this.canvas.removeEventListener('pointermove', this._onMouseMove, true);
                this._onMouseMove = null;
            }
        }

        // Remove selection box element
        if (this.selectionBox && this.selectionBox.parentNode) {
            this.selectionBox.remove();
            this.selectionBox = null;
        }

        this.canvas = null;
    }
}

export const inputManager = new InputManager();

export default InputManager;
