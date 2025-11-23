import axios, { AxiosInstance } from 'axios';

export class FigmaClient {
    private client: AxiosInstance;

    constructor(token: string) {
        this.client = axios.create({
            baseURL: 'https://api.figma.com/v1',
            headers: {
                'X-Figma-Token': token,
            },
        });
    }

    async getFile(fileKey: string, depth?: number) {
        const params: any = {};
        if (depth) params.depth = depth;
        const response = await this.client.get(`/files/${fileKey}`, { params });
        return response.data;
    }

    async getFileNodes(fileKey: string, ids: string[], depth?: number) {
        const params: any = { ids: ids.join(',') };
        if (depth) params.depth = depth;
        const response = await this.client.get(`/files/${fileKey}/nodes`, { params });
        return response.data;
    }

    async getImage(fileKey: string, ids: string[], format: 'png' | 'jpg' | 'svg' | 'pdf' = 'png', scale: number = 1) {
        const params = { ids: ids.join(','), format, scale };
        const response = await this.client.get(`/images/${fileKey}`, { params });
        return response.data;
    }

    async getImageFills(fileKey: string) {
        const response = await this.client.get(`/files/${fileKey}/images`);
        return response.data;
    }

    async getComments(fileKey: string) {
        const response = await this.client.get(`/files/${fileKey}/comments`);
        return response.data;
    }

    async getTeamProjects(teamId: string) {
        const response = await this.client.get(`/teams/${teamId}/projects`);
        return response.data;
    }

    async getProjectFiles(projectId: string) {
        const response = await this.client.get(`/projects/${projectId}/files`);
        return response.data;
    }
}
