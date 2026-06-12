import {
    apId,
    ListProjectRequestForPlatformQueryParams,
    PiecesFilterType,
    PrincipalType,
    Project,
    ProjectWithLimits,
    SeekPage,
    SERVICE_KEY_SECURITY_OPENAPI,
} from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { paginationHelper } from '../helper/pagination/pagination-utils'
import { userService } from '../user/user-service'
import { projectService } from './project-service'

export const projectController: FastifyPluginAsyncZod = async (app) => {

    app.get('/', ListProjectsRequest, async (req): Promise<SeekPage<ProjectWithLimits>> => {
        const platformId = req.principal.platform.id
        const userId = req.principal.id
        const user = await userService(req.log).getOneOrFail({ id: userId })
        const projects = await projectService(req.log).getAllForUser({
            platformId,
            userId,
            isPrivileged: userService(req.log).isUserPrivileged(user),
            displayName: req.query.displayName,
        })
        return paginationHelper.createPage(projects.map(toProjectWithLimits), null)
    })

    app.get('/:id', GetProjectRequest, async (req): Promise<ProjectWithLimits> => {
        const project = await projectService(req.log).getOneOrThrow(req.params.id)
        return toProjectWithLimits(project)
    })
}

function toProjectWithLimits({ deleted: _deleted, ...project }: Project): ProjectWithLimits {
    const now = new Date().toISOString()
    return {
        ...project,
        plan: {
            id: apId(),
            created: now,
            updated: now,
            projectId: project.id,
            locked: false,
            name: 'default',
            piecesFilterType: PiecesFilterType.NONE,
            pieces: [],
        },
        analytics: {
            totalUsers: 0,
            activeUsers: 0,
            totalFlows: 0,
            activeFlows: 0,
        },
    }
}

const ListProjectsRequest = {
    schema: {
        querystring: ListProjectRequestForPlatformQueryParams,
        response: {
            [StatusCodes.OK]: SeekPage(ProjectWithLimits),
        },
        tags: ['projects'],
        description: 'List projects',
        security: [SERVICE_KEY_SECURITY_OPENAPI],
    },
    config: {
        security: securityAccess.publicPlatform([PrincipalType.USER, PrincipalType.SERVICE]),
    },
}

const GetProjectRequest = {
    schema: {
        params: z.object({ id: z.string() }),
        response: {
            [StatusCodes.OK]: ProjectWithLimits,
        },
        tags: ['projects'],
        description: 'Get a project by id',
        security: [SERVICE_KEY_SECURITY_OPENAPI],
    },
    config: {
        security: securityAccess.publicPlatform([PrincipalType.USER, PrincipalType.SERVICE]),
    },
}
