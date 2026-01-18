// ============================================================
// VOID SUPREMACY 3D - Input Manager
// Handles keyboard, mouse input and hotkeys
// ============================================================

import { TEAMS } from '../core/Config.js';
import { eventBus, GameEvents } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { selectionSystem } from '../systems/SelectionSystem.js';
import { sceneManager } from '../rendering/SceneManager.js';

export class InputManager {
    constructor() {
        this.canvas = null;
        this.keysDown = new Set();
        this.isDragging = false;
        this.dragStart = null;
        this.dragEnd = null;
        this.mouseX = 0;
        this.mouseY = 0;

        // Edge scrolling
        this.edgeScrollSpeed = 300;
        this.edgeScrollMargin = 20;

        // Camera rotation speed (radians per second)
        this.cameraRotateSpeed = 2;
    }

    init(canvas) {
        this.canvas = canvas;

        // Keyboard events
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Mouse events
        canvas.addEventListener('click', (e) => this.onClick(e));
        canvas.addEventListener('contextmenu', (e) => this.onRightClick(e));
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));

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
        // Number keys - control groups
        if (e.code >= 'Digit0' && e.code <= 'Digit9') {
            const num = parseInt(e.code.replace('Digit', ''));

            if (e.ctrlKey) {
                // Ctrl + Number: Set control group
                selectionSystem.setControlGroup(num);
            } else {
                // Number: Select control group
                selectionSystem.selectControlGroup(num, e.shiftKey);
            }
            return;
        }

        // Command hotkeys
        switch (e.code) {
            case 'KeyX':
                // Stop (X key - S is used for camera movement)
                selectionSystem.commandStop();
                break;

            case 'KeyH':
                // Hold position
                selectionSystem.commandHold();
                break;

            case 'KeyG':
                // Attack-move mode (G key - A is used for camera movement)
                eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, {
                    mode: 'attackMove'
                });
                break;

            case 'KeyP':
                // Patrol mode (requires click)
                eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, {
                    mode: 'patrol'
                });
                break;

            case 'Escape':
                // Cancel build mode or deselect
                if (gameState.buildMode) {
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

        // Building hotkeys (B + key for build menu)
        if (e.code === 'KeyB') {
            eventBus.emit(GameEvents.UI_BUILD_MODE_ENTER, {
                mode: 'buildMenu'
            });
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
        if (this.isDragging) return;

        const entity = sceneManager.pickEntity(e.clientX, e.clientY, gameState.entities);
        const worldPos = sceneManager.getWorldPosition(e.clientX, e.clientY);

        // Handle build mode
        if (gameState.buildMode) {
            if (worldPos) {
                this.handleBuildModeClick(worldPos);
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

    handleBuildModeClick(worldPos) {
        if (gameState.buildMode === 'attackMove') {
            selectionSystem.commandAttackMove(worldPos.x, worldPos.z);
            eventBus.emit(GameEvents.UI_BUILD_MODE_EXIT, {});
        } else if (gameState.buildMode === 'patrol') {
            selectionSystem.commandPatrol(worldPos.x, worldPos.z);
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
        if (e.button === 0) { // Left button
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.dragEnd = { x: e.clientX, y: e.clientY };

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

            // Only trigger box select if dragged more than a few pixels
            const dx = Math.abs(this.dragEnd.x - this.dragStart.x);
            const dy = Math.abs(this.dragEnd.y - this.dragStart.y);

            if (dx > 5 || dy > 5) {
                const startWorld = sceneManager.getWorldPosition(this.dragStart.x, this.dragStart.y);
                const endWorld = sceneManager.getWorldPosition(this.dragEnd.x, this.dragEnd.y);

                if (startWorld && endWorld) {
                    eventBus.emit(GameEvents.INPUT_DRAG_END, {
                        startX: startWorld.x,
                        startZ: startWorld.z,
                        endX: endWorld.x,
                        endZ: endWorld.z,
                        addToSelection: e.shiftKey
                    });
                }
            }
        }
    }

    onMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;

        if (this.isDragging) {
            this.dragEnd = { x: e.clientX, y: e.clientY };
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
    }
}

export const inputManager = new InputManager();

export default InputManager;
