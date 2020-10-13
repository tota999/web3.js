import Axios, {AxiosInstance} from 'axios'

import { ETH2BaseOpts, ETH2Function } from '../types/index'
import { IBaseAPISchema } from './schema'

export class ETH2Core {
    private _httpClient: AxiosInstance

    [ key: string ]: ETH2Function | any;
    
    name: string
    provider: string
    protectProvider: boolean

    constructor(provider: string, opts: ETH2BaseOpts = {}, schema: IBaseAPISchema) {
        this.name = schema.packageName
        this.setProvider(`${provider}${schema.routePrefix}`)
        this.protectProvider = opts.protectProvider || false
        this.buildAPIWrappersFromSchema(schema)
    }

    static createHttpClient(baseUrl: string): AxiosInstance {
        try {
            return Axios.create({
                baseURL: baseUrl
            })
        } catch (error) {
            throw new Error(`Failed to create HTTP client: ${error.message}`)
        }
    }

    setProvider(provider: string) {
        try {
            if (!provider || typeof provider !== 'string' || !/^http(s)?:\/\//i.test(provider)) {
                throw new Error(`Invalid HTTP(S) provider: ${provider}`)
            }

            const result = ETH2Core.createHttpClient(provider)
            this._httpClient = result

            this.provider = provider
        } catch (error) {
            throw new Error(`Failed to set provider: ${error.message}`)
        }
    }

    private routeBuilder(rawUrl: string, parameters: any): string {
        try {
            let computedRoute = rawUrl

            // Find all: ${valuesWeWant} in rawUrl, returns array with only valuesWeWant
            const foundIdentifiers = rawUrl.match(/(?<=\$\{).*?(?=\})/gm) // Matches ${valueWeWant}, but doesn't include ${}

            if (foundIdentifiers !== null) {
                for (const foundIdentifier of foundIdentifiers) {
                    computedRoute = computedRoute.replace(`\${${foundIdentifier}}`, parameters[foundIdentifier])
                }
            }
            
            return computedRoute
        } catch (error) {
            throw new Error(`Failed to build route: ${error.message}`)
        }
    }

    private buildAPIWrappersFromSchema(schema: IBaseAPISchema) {
        for (const method of schema.methods) {
            if (method.notImplemented) {
                this[method.name] = async () => { throw new Error('Method not implemented by beacon chain client') }
                continue;
            }

            this[method.name] = async (routeParameters: any, queryParameters: any = {}): Promise<any> => {
                try {
                    if (method.inputFormatter) queryParameters = method.inputFormatter(queryParameters)

                    const computedRoute = this.routeBuilder(method.route, routeParameters)
                    let {data} = await this._httpClient[method.restMethod](computedRoute, { queryParameters })
                    if (data.data) data = data.data

                    if (method.outputFormatter) data = method.outputFormatter(data)
                    return data
                } catch (error) {
                    throw new Error(`${method.errorPrefix} ${error.message}`)
                }
            }
        }
    }
}
