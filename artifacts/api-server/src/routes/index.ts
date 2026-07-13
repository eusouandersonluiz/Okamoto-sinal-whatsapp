import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import metricsRouter from "./metrics";
import topicsRouter from "./topics";
import groupsRouter from "./groups";
import mediaRouter from "./media";
import searchRouter from "./search";
import refreshRouter from "./refresh";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(metricsRouter);
router.use(topicsRouter);
router.use(groupsRouter);
router.use(mediaRouter);
router.use(searchRouter);
router.use(refreshRouter);

export default router;
