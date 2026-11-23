# Feedback inbox

Notes made with the in-app **Feedback mode** (press `F` in the preview) are saved here as
`feedback-<timestamp>.json`, with a screenshot of your view for each note in `shots/`.

Each note has: `type` (fix / add / remove / move / other), your `comment`, the clicked object
(`target.path`, size, material), the exact world `point` + surface `normal`, and the `camera`
position/yaw/pitch so the view can be reproduced.

**Processing:** read every `feedback-*.json` in this folder, apply the notes, then move the file
(and its shots) into `processed/`.
