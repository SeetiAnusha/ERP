/**
 * Service Factory - Centralized service instantiation with dependency injection
 * Implements Singleton pattern for service instances
 */

import { BaseService } from './BaseService';

export interface ServiceDependencies {
  logger?: any;
  config?: any;
  metrics?: any;
  cache?: any;
}

export class ServiceFactory {
  private static instances = new Map<string, any>();
  private static dependencies: ServiceDependencies = {};
  
  /**
   * Configure global dependencies for all services
   */
  static configure(dependencies: ServiceDependencies): void {
    ServiceFactory.dependencies = { ...ServiceFactory.dependencies, ...dependencies };
  }
  
  /**
   * Get or create service instance
   */
  static getInstance<T extends BaseService>(
    ServiceClass: new (...args: any[]) => T,
    ...additionalArgs: any[]
  ): T {
    const serviceName = ServiceClass.name;
    
    if (!ServiceFactory.instances.has(serviceName)) {
      const instance = new ServiceClass(ServiceFactory.dependencies, ...additionalArgs);
      ServiceFactory.instances.set(serviceName, instance);
    }
    
    return ServiceFactory.instances.get(serviceName);
  }
  
  /**
   * Clear all service instances (useful for testing)
   */
  static clearInstances(): void {
    ServiceFactory.instances.clear();
  }
  
  /**
   * Get all registered service names
   */
  static getRegisteredServices(): string[] {
    return Array.from(ServiceFactory.instances.keys());
  }
}