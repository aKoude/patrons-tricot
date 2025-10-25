"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        {
            method: 'GET',
            path: '/patterns/list',
            handler: 'custom-pattern.findAll',
            config: {
                auth: false,
            },
        },
        {
            method: 'GET',
            path: '/patterns/:documentId/full',
            handler: 'custom-pattern.findOneFull',
            config: {
                auth: false,
            },
        },
        {
            method: 'GET',
            path: '/patterns/unlocked',
            handler: 'custom-pattern.findUnlocked',
            config: {
                auth: false,
            },
        },
        {
            method: 'POST',
            path: '/patterns/:documentId/unlock',
            handler: 'custom-pattern.unlock',
            config: {
                auth: false,
            },
        },
        {
            method: 'POST',
            path: '/patterns/:documentId/start',
            handler: 'custom-pattern.start',
            config: {
                auth: false,
            },
        },
        {
            method: 'GET',
            path: '/debug/accesses',
            handler: 'custom-pattern.debugAccesses',
            config: {
                auth: false,
            },
        },
        {
            method: 'GET',
            path: '/debug/progresses',
            handler: 'custom-pattern.debugProgresses',
            config: {
                auth: false,
            },
        },
    ],
};
