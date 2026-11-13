
import {
    SequenceAnalysis,
    DiagramDocument
} from '../utilities/types';

export function buildSequenceDiagram(
    analysis: SequenceAnalysis
): DiagramDocument {

    const entities: DiagramDocument['entities'] = [];
    const connections: DiagramDocument['connections'] = [];

    const usedIds = new Set<string>();

    const LEFT = 80;
    const TOP = 80;

    const PARTICIPANT_WIDTH = 190;
    const PARTICIPANT_GAP = 75;
    const PARTICIPANT_HEIGHT = 90;

    const MESSAGE_HEIGHT = 65;
    const MESSAGE_GAP = 28;

    function uniqueId(value: string): string {

        const base = value
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/^_+|_+$/g, '') || 'sequence_item';

        let id = base;
        let suffix = 2;

        while (usedIds.has(id)) {
            id = `${base}_${suffix++}`;
        }

        usedIds.add(id);
        return id;
    }

    const participantPositions = new Map<
        string,
        { x: number; center: number }
    >();

    const diagramWidth =
        analysis.participants.length * PARTICIPANT_WIDTH +
        (analysis.participants.length - 1) * PARTICIPANT_GAP;

    const messageStartY = TOP + PARTICIPANT_HEIGHT + 65;

    const diagramHeight =
        messageStartY +
        analysis.messages.length * (
            MESSAGE_HEIGHT + MESSAGE_GAP
        ) + 100;

    // Participant headers and lifelines.
    analysis.participants.forEach((participant, index) => {

        const x = LEFT + index * (
            PARTICIPANT_WIDTH + PARTICIPANT_GAP
        );

        const center = x + PARTICIPANT_WIDTH / 2;

        participantPositions.set(participant.id, {
            x,
            center
        });

        entities.push({
            tag: 'Shape',
            id: uniqueId(`participant_${participant.id}`),
            shape: 'rectangle',
            x,
            y: TOP,
            width: PARTICIPANT_WIDTH,
            height: PARTICIPANT_HEIGHT,
            color: 'white',
            texts: [
                {
                    text: participant.name,
                    fontSize: 15
                },
                {
                    text: participant.technology || 'Unknown',
                    fontSize: 11,
                    color: '#526174'
                },
                {
                    text: participant.type || 'Component',
                    fontSize: 10,
                    color: '#526174'
                }
            ]
        });

        // Lifeline is drawn as a narrow vertical shape.
        entities.push({
            tag: 'Shape',
            id: uniqueId(`lifeline_${participant.id}`),
            shape: 'rectangle',
            x: center - 2,
            y: TOP + PARTICIPANT_HEIGHT + 12,
            width: 4,
            height: diagramHeight - PARTICIPANT_HEIGHT - 40,
            color: '#94a3b8'
        });
    });

    // Ordered message rows.
    analysis.messages.forEach((message, index) => {

        const from = participantPositions.get(message.from);
        const to = participantPositions.get(message.to);

        if (!from || !to) return;

        const y = messageStartY + index * (
            MESSAGE_HEIGHT + MESSAGE_GAP
        );

        const left = Math.min(from.center, to.center);
        const right = Math.max(from.center, to.center);

        const width = Math.max(180, right - left);

        const isReturn = message.type === 'return';
        const isAsync = message.type === 'async';

        const arrow = isReturn
            ? '⇢'
            : isAsync
                ? '➤'
                : '→';

        const direction = from.center < to.center
            ? `${message.from} to ${message.to}`
            : `${message.to} to ${message.from}`;

        const messageText =
            `${index + 1}. ${message.label}  ${arrow}`;

        entities.push({
            tag: 'Shape',
            id: uniqueId(`message_${index + 1}`),
            shape: 'rectangle',
            x: left,
            y,
            width,
            height: MESSAGE_HEIGHT,
            color: isReturn ? '#e8f7ed' : '#eaf2ff',
            texts: [
                {
                    text: messageText,
                    fontSize: 12
                },
                {
                    text: `${message.type.toUpperCase()} | ${direction}`,
                    fontSize: 9,
                    color: '#526174'
                }
            ]
        });
    });

    const ids = entities.map(entity => entity.id);

    if (new Set(ids).size !== ids.length) {
        throw new Error(
            'Sequence diagram contains duplicate entity IDs.'
        );
    }

    console.log(
        '[DocFlowAI] Sequence Diagram:',
        entities.length,
        'entities,',
        analysis.messages.length,
        'ordered messages.'
    );

    return {
        entities,
        connections,
        outputs: {
            png: true,
            json: true
        }
    };
}
