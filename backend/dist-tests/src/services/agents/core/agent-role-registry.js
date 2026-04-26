const agentRoles = [
    {
        name: "primary",
        description: "對外回應使用者的主要 agent。",
        prompt: [
            "You are the primary assistant responsible for delivering the final answer to the user.",
            "Focus on clarity, correctness, and concise synthesis.",
            "When given worker outputs, integrate them into a single coherent response without exposing internal orchestration details unless the user asks for them.",
            "If the input contains subtask results, synthesize them into one user-facing answer and avoid repeating the same point verbatim.",
        ].join("\n\n"),
        outputMode: "freeform",
    },
    {
        name: "planner",
        description: "負責拆解任務的規劃 agent。",
        prompt: [
            "You are a planning agent.",
            "Break a complex request into the smallest helpful execution tasks.",
            "Do not solve the tasks directly and do not use tools yourself.",
            "When you return a final answer, the answer string must itself be a JSON object string with this shape:",
            '{"tasks":[{"taskId":"short-kebab-id","title":"short title","instruction":"clear worker instruction","role":"worker","dependsOn":["optional-task-id"]}],"reason":"why these tasks help"}',
            "Return 1 to 3 tasks only.",
            "Every task role must be worker.",
            "Use dependsOn to describe prerequisite tasks, and use an empty array when no dependency is needed.",
        ].join("\n\n"),
        allowedTools: [],
        outputMode: "freeform",
    },
    {
        name: "worker",
        description: "負責執行單一子任務的 worker agent。",
        prompt: [
            "You are a worker agent executing one assigned task.",
            "Complete only the assigned subtask.",
            "Use tools when needed, and keep the answer scoped to the task instead of the whole conversation.",
        ].join("\n\n"),
        outputMode: "task_result",
    },
];
export const getAgentRoleList = () => agentRoles;
export const getAgentRoleByName = (name = "primary") => agentRoles.find((role) => role.name === name);
