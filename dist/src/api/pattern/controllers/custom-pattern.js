"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
exports.default = strapi_1.factories.createCoreController('api::pattern.pattern', ({ strapi }) => ({
    // Liste tous les patterns (bibliothèque)
    async findAll(ctx) {
        try {
            const patterns = await strapi.db.query('api::pattern.pattern').findMany({
                populate: {
                    coverImage: true,
                    patternSizes: {
                        fields: ['sizeName', 'sizeOrder'],
                        orderBy: { sizeOrder: 'asc' },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            return ctx.send({
                data: patterns.map((pattern) => ({
                    id: pattern.id,
                    documentId: pattern.documentId,
                    title: pattern.title,
                    description: pattern.description,
                    difficulty: pattern.difficulty,
                    category: pattern.category,
                    type: pattern.type,
                    coverImage: pattern.coverImage,
                    estimatedTime: pattern.estimatedTime,
                    creditCost: pattern.creditCost,
                    hasSizes: pattern.hasSizes,
                    hasGauge: pattern.hasGauge,
                    patternSizes: pattern.patternSizes,
                    createdAt: pattern.createdAt,
                }))
            });
        }
        catch (error) {
            console.error('Error fetching patterns:', error);
            return ctx.internalServerError('Error fetching patterns');
        }
    },
    // Détail complet d'un pattern
    async findOneFull(ctx) {
        const { documentId } = ctx.params;
        try {
            const pattern = await strapi.db.query('api::pattern.pattern').findOne({
                where: { documentId: documentId },
                populate: {
                    coverImage: true,
                    patternSizes: {
                        populate: {
                            sections: {
                                populate: {
                                    steps: true,
                                },
                                orderBy: { sectionNumber: 'asc' },
                            },
                        },
                        orderBy: { sizeOrder: 'asc' },
                    },
                    sections: {
                        populate: {
                            steps: true,
                        },
                        orderBy: { sectionNumber: 'asc' },
                    },
                },
            });
            if (!pattern) {
                return ctx.notFound('Pattern not found');
            }
            return ctx.send({
                data: pattern
            });
        }
        catch (error) {
            console.error('Error fetching pattern:', error);
            return ctx.internalServerError('Error fetching pattern');
        }
    },
    // Mes patterns débloqués
    async findUnlocked(ctx) {
        // Temporaire : récupérer le user manuellement pour test
        let user = ctx.state.user;
        if (!user) {
            user = await strapi.db.query('plugin::users-permissions.user').findOne({
                where: { id: 1 },
            });
            if (!user) {
                return ctx.badRequest('Test user not found');
            }
        }
        try {
            const allAccesses = await strapi.db.query('api::user-pattern-access.user-pattern-access').findMany({
                where: {
                    isActive: true,
                },
                populate: {
                    user: true,
                    pattern: {
                        populate: {
                            coverImage: true,
                            patternSizes: {
                                fields: ['sizeName'],
                            },
                        },
                    },
                },
            });
            // Filtrer manuellement par user.id
            const userAccesses = allAccesses.filter((access) => { var _a; return ((_a = access.user) === null || _a === void 0 ? void 0 : _a.id) === user.id; });
            const patterns = userAccesses.map((access) => access.pattern);
            return ctx.send({
                data: patterns
            });
        }
        catch (error) {
            console.error('Error fetching unlocked patterns:', error);
            return ctx.internalServerError('Error fetching unlocked patterns');
        }
    },
    // Débloquer un patron (SANS choisir de taille)
    async unlock(ctx) {
        // Temporaire : récupérer le user manuellement pour test
        let user = ctx.state.user;
        if (!user) {
            user = await strapi.db.query('plugin::users-permissions.user').findOne({
                where: { id: 1 },
            });
            if (!user) {
                return ctx.badRequest('Test user not found');
            }
        }
        const { documentId } = ctx.params;
        try {
            // Récupérer le patron
            const pattern = await strapi.db.query('api::pattern.pattern').findOne({
                where: { documentId: documentId },
            });
            if (!pattern) {
                return ctx.notFound('Pattern not found');
            }
            // Vérifier si déjà débloqué
            const allAccesses = await strapi.db.query('api::user-pattern-access.user-pattern-access').findMany({
                where: {
                    isActive: true,
                },
                populate: {
                    user: true,
                    pattern: true,
                },
            });
            console.log('All accesses:', allAccesses.length);
            console.log('Looking for user.id:', user.id);
            console.log('Looking for pattern.documentId:', pattern.documentId);
            const existingAccess = allAccesses.find((access) => {
                var _a, _b;
                return ((_a = access.user) === null || _a === void 0 ? void 0 : _a.id) === user.id &&
                    ((_b = access.pattern) === null || _b === void 0 ? void 0 : _b.documentId) === pattern.documentId;
            });
            console.log('Existing access found:', !!existingAccess);
            if (existingAccess) {
                return ctx.send({
                    success: true,
                    message: 'Pattern already unlocked',
                    alreadyUnlocked: true,
                });
            }
            // Récupérer l'utilisateur avec ses crédits
            const userWithCredits = await strapi.db.query('plugin::users-permissions.user').findOne({
                where: { id: user.id },
            });
            const creditCost = pattern.creditCost || 1;
            // Vérifier les crédits
            if (userWithCredits.credits < creditCost) {
                return ctx.badRequest({
                    success: false,
                    error: 'Insufficient credits',
                    creditsNeeded: creditCost,
                    creditsAvailable: userWithCredits.credits,
                });
            }
            // Déduire les crédits
            const newCredits = userWithCredits.credits - creditCost;
            await strapi.db.query('plugin::users-permissions.user').update({
                where: { id: user.id },
                data: { credits: newCredits },
            });
            console.log('Credits updated. New balance:', newCredits);
            // Créer l'accès (avec documentId pour la relation)
            const newAccess = await strapi.db.query('api::user-pattern-access.user-pattern-access').create({
                data: {
                    user: user.id,
                    pattern: pattern.id,
                    creditsSpent: creditCost,
                    isActive: true,
                    unlockedAt: new Date(),
                },
            });
            console.log('UserPatternAccess created:', newAccess.id);
            return ctx.send({
                success: true,
                message: 'Pattern unlocked successfully! Choose a size to start.',
                creditsRemaining: newCredits,
                creditsSpent: creditCost,
                patternUnlocked: true,
                needsSizeSelection: pattern.hasSizes,
            });
        }
        catch (error) {
            console.error('Error unlocking pattern:', error);
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
            return ctx.internalServerError('Error unlocking pattern');
        }
    },
    // Démarrer un patron (avec choix de taille)
    async start(ctx) {
        // Temporaire : récupérer le user manuellement pour test
        let user = ctx.state.user;
        if (!user) {
            user = await strapi.db.query('plugin::users-permissions.user').findOne({
                where: { id: 1 },
            });
            if (!user) {
                return ctx.badRequest('Test user not found');
            }
        }
        const { documentId } = ctx.params;
        const { sizeId } = ctx.request.body;
        try {
            // Vérifier que le patron est débloqué
            const allAccesses = await strapi.db.query('api::user-pattern-access.user-pattern-access').findMany({
                where: {
                    isActive: true,
                },
                populate: {
                    user: true,
                    pattern: true,
                },
            });
            const access = allAccesses.find((access) => {
                var _a, _b;
                return ((_a = access.user) === null || _a === void 0 ? void 0 : _a.id) === user.id &&
                    ((_b = access.pattern) === null || _b === void 0 ? void 0 : _b.documentId) === documentId;
            });
            if (!access) {
                return ctx.forbidden({
                    success: false,
                    error: 'Pattern not unlocked. Please unlock it first.',
                });
            }
            // Récupérer le patron complet
            const pattern = await strapi.db.query('api::pattern.pattern').findOne({
                where: { documentId: documentId },
                populate: {
                    patternSizes: {
                        populate: {
                            sections: {
                                populate: {
                                    steps: true,
                                },
                                orderBy: { sectionNumber: 'asc' },
                            },
                        },
                    },
                    sections: {
                        populate: {
                            steps: true,
                        },
                        orderBy: { sectionNumber: 'asc' },
                    },
                },
            });
            if (!pattern) {
                return ctx.notFound('Pattern not found');
            }
            // Vérifier si déjà démarré
            const allProgresses = await strapi.db.query('api::user-progress.user-progress').findMany({
                populate: {
                    user: true,
                    pattern: true,
                },
            });
            const existingProgress = allProgresses.find((progress) => {
                var _a, _b;
                return ((_a = progress.user) === null || _a === void 0 ? void 0 : _a.id) === user.id &&
                    ((_b = progress.pattern) === null || _b === void 0 ? void 0 : _b.documentId) === documentId;
            });
            if (existingProgress) {
                return ctx.send({
                    success: true,
                    message: 'Pattern already started',
                    alreadyStarted: true,
                    progress: existingProgress,
                });
            }
            // Vérifier si taille requise
            if (pattern.hasSizes && !sizeId) {
                return ctx.badRequest({
                    success: false,
                    error: 'Size selection required for this pattern',
                });
            }
            // Vérifier que la taille existe
            if (pattern.hasSizes) {
                const sizeExists = pattern.patternSizes.some((s) => s.id === sizeId);
                if (!sizeExists) {
                    return ctx.badRequest({
                        success: false,
                        error: 'Invalid size',
                    });
                }
            }
            // Récupérer les sections selon la taille
            let sections;
            if (pattern.hasSizes) {
                const selectedSize = pattern.patternSizes.find((s) => s.id === sizeId);
                sections = selectedSize.sections;
            }
            else {
                sections = pattern.sections;
            }
            // Créer UserProgress avec selectedSize
            const sectionsProgress = sections.map((section) => {
                const totalStitches = section.steps.reduce((sum, step) => {
                    if (step.isRepeatable) {
                        return sum + (step.stitchCount * step.repeatCount);
                    }
                    return sum + step.stitchCount;
                }, 0);
                return {
                    sectionId: section.id,
                    sectionTitle: section.title,
                    sectionNumber: section.sectionNumber,
                    completedSteps: [],
                    completedSubSteps: {},
                    totalSteps: section.steps.length,
                    completedStitches: 0,
                    totalStitches: totalStitches,
                    progressPercentage: 0,
                    isCompleted: false,
                    completedAt: null,
                };
            });
            const progressData = {
                user: user.id,
                pattern: pattern.id,
                sectionsProgress: sectionsProgress,
                overallProgress: 0,
                startedAt: new Date(),
                lastUpdatedAt: new Date(),
                isCompleted: false,
            };
            // Ajouter selectedSize si applicable
            if (pattern.hasSizes) {
                const selectedSize = pattern.patternSizes.find((s) => s.id === sizeId);
                progressData.selectedSize = {
                    sizeId: selectedSize.id,
                    sizeName: selectedSize.sizeName,
                };
            }
            const newProgress = await strapi.db.query('api::user-progress.user-progress').create({
                data: progressData,
            });
            console.log('UserProgress created:', newProgress.id);
            return ctx.send({
                success: true,
                message: 'Pattern started successfully!',
                selectedSize: progressData.selectedSize || null,
                progress: newProgress,
            });
        }
        catch (error) {
            console.error('Error starting pattern:', error);
            console.error('Error details:', error.message);
            return ctx.internalServerError('Error starting pattern');
        }
    },
    // Debug: Voir tous les accesses
    async debugAccesses(ctx) {
        try {
            const accesses = await strapi.db.query('api::user-pattern-access.user-pattern-access').findMany({
                populate: {
                    user: true,
                    pattern: true,
                },
            });
            return ctx.send({
                count: accesses.length,
                data: accesses.map((access) => {
                    var _a, _b, _c, _d, _e;
                    return ({
                        id: access.id,
                        documentId: access.documentId,
                        userId: (_a = access.user) === null || _a === void 0 ? void 0 : _a.id,
                        userEmail: (_b = access.user) === null || _b === void 0 ? void 0 : _b.email,
                        patternId: (_c = access.pattern) === null || _c === void 0 ? void 0 : _c.id,
                        patternDocumentId: (_d = access.pattern) === null || _d === void 0 ? void 0 : _d.documentId,
                        patternTitle: (_e = access.pattern) === null || _e === void 0 ? void 0 : _e.title,
                        creditsSpent: access.creditsSpent,
                        isActive: access.isActive,
                        unlockedAt: access.unlockedAt,
                        publishedAt: access.publishedAt,
                    });
                }),
            });
        }
        catch (error) {
            console.error('Error fetching accesses:', error);
            return ctx.internalServerError('Error fetching accesses');
        }
    },
    // Debug: Voir tous les progresses
    async debugProgresses(ctx) {
        try {
            const progresses = await strapi.db.query('api::user-progress.user-progress').findMany({
                populate: {
                    user: true,
                    pattern: true,
                },
            });
            return ctx.send({
                count: progresses.length,
                data: progresses.map((progress) => {
                    var _a, _b, _c, _d, _e;
                    return ({
                        id: progress.id,
                        documentId: progress.documentId,
                        userId: (_a = progress.user) === null || _a === void 0 ? void 0 : _a.id,
                        userEmail: (_b = progress.user) === null || _b === void 0 ? void 0 : _b.email,
                        patternId: (_c = progress.pattern) === null || _c === void 0 ? void 0 : _c.id,
                        patternDocumentId: (_d = progress.pattern) === null || _d === void 0 ? void 0 : _d.documentId,
                        patternTitle: (_e = progress.pattern) === null || _e === void 0 ? void 0 : _e.title,
                        selectedSize: progress.selectedSize,
                        overallProgress: progress.overallProgress,
                        isCompleted: progress.isCompleted,
                        startedAt: progress.startedAt,
                        publishedAt: progress.publishedAt,
                    });
                }),
            });
        }
        catch (error) {
            console.error('Error fetching progresses:', error);
            return ctx.internalServerError('Error fetching progresses');
        }
    },
}));
