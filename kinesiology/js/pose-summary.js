/** Labels for every joint that has left the model's neutral pose. */

export function poseMarks(joints, readDegrees) {
  const marks = [];
  for (const joint of joints) {
    if (!joint.dofs) continue;
    const sides = joint.sided === false ? [null] : ["right", "left"];
    for (const side of sides) {
      const lines = [];
      for (const dof of joint.dofs) {
        const degrees = readDegrees(dof, joint, side);
        if (Math.abs(degrees) < 0.5) continue;
        const amount = Math.abs(Math.round(degrees));
        const name = degrees > 0 ? dof.positive : dof.negative;
        lines.push(`${amount}° ${name.toLowerCase()}`);
      }
      if (!lines.length) continue;
      const title = side ? `${side === "right" ? "Right" : "Left"} ${joint.title.toLowerCase()}` : joint.title;
      marks.push({
        id: `${joint.id}:${side || "mid"}`,
        jointId: joint.id,
        side,
        title,
        lines,
      });
    }
  }
  return marks;
}
