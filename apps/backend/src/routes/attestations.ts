import { Router } from "express";
import { AttestationService } from "../services/AttestationService";

const router = Router();
const service = new AttestationService();

router.get("/", async (_req, res) => {
  try {
    const all = await service.getAll();
    res.json(all);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attestations" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const attestation = await service.getById(req.params.id);
    if (!attestation) {
      return res.status(404).json({ error: "Attestation not found" });
    }

    // Include hash verification
    const steps = attestation.reasoningSteps as unknown[];
    const verified = AttestationService.verifyHash(steps, attestation.reasoningHash);

    res.json({ ...attestation, verified });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attestation" });
  }
});

export { router as attestationRoutes };
