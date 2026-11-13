
import {
    ArchitectureAnalysis,
    DiagramDocument
} from '../utilities/types';

export function buildEraserDiagram(
    analysis: ArchitectureAnalysis
): DiagramDocument {

    const entities: DiagramDocument['entities'] = [];
    const connections: DiagramDocument['connections'] = [];

    const COLUMN_WIDTH = 300;
    const COLUMN_GAP = 90;
    const COMPONENT_HEIGHT = 105;
    const COMPONENT_GAP = 25;
    const TOP = 90;
    const LEFT = 60;

    // All entity IDs must be globally unique.
    const usedIds = new Set<string>();

    // Maps original component IDs to generated diagram IDs.
    const componentIdMap = new Map<string, string>();

    // Tracks the next available ID suffix.
    const idCounters = new Map<string, number>();

    function createUniqueId(
        originalId: string,
        fallback: string
    ): string {

        const baseId = (
            originalId || fallback
        )
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/^_+|_+$/g, '') || 'component';

        let uniqueId = baseId;

        if (usedIds.has(uniqueId)) {

            let counter = idCounters.get(baseId) || 2;

            while (usedIds.has(`${baseId}_${counter}`)) {
                counter++;
            }

            uniqueId = `${baseId}_${counter}`;

            idCounters.set(baseId, counter + 1);
        }

        usedIds.add(uniqueId);

        return uniqueId;
    }

    // --------------------------------------------------
    // CREATE LAYERS AND COMPONENTS
    // --------------------------------------------------

    analysis.layers.forEach((layer, layerIndex) => {

        const x = LEFT + layerIndex * (
            COLUMN_WIDTH + COLUMN_GAP
        );

        const componentCount = layer.components.length;

        const containerHeight = Math.max(
            210,
            115 + componentCount * (
                COMPONENT_HEIGHT + COMPONENT_GAP
            )
        );

        const containerId = createUniqueId(
            `layer_${layerIndex + 1}`,
            `layer_${layerIndex + 1}`
        );

        entities.push({
            tag: 'Group',
            id: containerId,
            title: {
                text: layer.name
            },
            x,
            y: TOP,
            width: COLUMN_WIDTH,
            height: containerHeight,
            color: [
                'blue',
                'purple',
                'green',
                'orange',
                'yellow',
                'red'
            ][layerIndex % 6]
        });

        layer.components.forEach((component, componentIndex) => {

            const componentX = x + 25;

            const componentY = TOP + 75 +
                componentIndex * (
                    COMPONENT_HEIGHT + COMPONENT_GAP
                );

            const originalId = component.id;

            const generatedId = createUniqueId(
                originalId,
                component.name
            );

            // Store the mapping for connection generation.
            // Preserve the first occurrence of an original ID.
            if (!componentIdMap.has(originalId)) {
                componentIdMap.set(
                    originalId,
                    generatedId
                );
            }

            entities.push({
                tag: 'Shape',
                id: generatedId,
                shape: 'rectangle',
                x: componentX,
                y: componentY,
                width: COLUMN_WIDTH - 50,
                height: COMPONENT_HEIGHT,
                containerId,
                color: 'white',
                texts: [
                    {
                        text: component.name,
                        fontSize: 16
                    },
                    {
                        text: component.technology || 'Unknown',
                        fontSize: 12,
                        color: '#526174'
                    },
                    {
                        text: component.description,
                        fontSize: 11,
                        color: '#526174'
                    }
                ]
            });
        });
    });

    // --------------------------------------------------
    // CREATE CONNECTIONS
    // --------------------------------------------------

    const createdConnections = new Set<string>();

    for (const connection of analysis.connections) {

        const fromId = componentIdMap.get(connection.from);
        const toId = componentIdMap.get(connection.to);

        if (!fromId || !toId) {
            continue;
        }

        if (fromId === toId) {
            continue;
        }

        const connectionKey = `${fromId}::${toId}`;

        if (createdConnections.has(connectionKey)) {
            continue;
        }

        createdConnections.add(connectionKey);

        connections.push({
            from: fromId,
            to: toId,
            endArrowhead: 'triangle',
            label: connection.label || 'Data flow'
        });
    }

    // DEBUG: Verify entity ID uniqueness before Eraser rendering.
    const allIds = entities.map(entity => entity.id);
    const duplicateIds = allIds.filter(
        (id, index) => allIds.indexOf(id) !== index
    );

    console.log('[DocFlowAI] Total entities:', allIds.length);
    console.log('[DocFlowAI] Unique entities:', new Set(allIds).size);
    console.log('[DocFlowAI] Duplicate IDs:', duplicateIds);

    if (duplicateIds.length > 0) {
        throw new Error(
            `Architecture builder generated duplicate IDs: ${
                [...new Set(duplicateIds)].join(', ')
            }`
        );
    }

    return {
        entities,
        connections,
        outputs: {
            png: true,
            json: true
        }
    };
}
