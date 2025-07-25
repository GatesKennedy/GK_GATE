import { Injectable, Logger } from '@nestjs/common';
import { RouteTarget, LoadBalancerAlgorithm } from '../types/route.types';

@Injectable()
export class LoadBalancerService {
  private readonly logger = new Logger(LoadBalancerService.name);
  private roundRobinCounters = new Map<string, number>();
  private connectionCounts = new Map<string, number>();

  /**
   * Select target based on load balancer algorithm
   */
  selectTarget(
    targets: RouteTarget[],
    algorithm: LoadBalancerAlgorithm,
    routeKey: string,
    _sessionId?: string
  ): RouteTarget | null {
    const healthyTargets = targets.filter(target => target.isHealthy);
    
    if (healthyTargets.length === 0) {
      this.logger.warn(`No healthy targets available for route: ${routeKey}`);
      return null;
    }

    switch (algorithm) {
      case LoadBalancerAlgorithm.ROUND_ROBIN:
        return this.roundRobinSelection(healthyTargets, routeKey);
      
      case LoadBalancerAlgorithm.WEIGHTED_ROUND_ROBIN:
        return this.weightedRoundRobinSelection(healthyTargets, routeKey);
      
      case LoadBalancerAlgorithm.LEAST_CONNECTIONS:
        return this.leastConnectionsSelection(healthyTargets);
      
      case LoadBalancerAlgorithm.LEAST_RESPONSE_TIME:
        return this.leastResponseTimeSelection(healthyTargets);
      
      case LoadBalancerAlgorithm.HEALTH_BASED:
        return this.healthBasedSelection(healthyTargets);
      
      case LoadBalancerAlgorithm.RANDOM:
        return this.randomSelection(healthyTargets);
      
      default:
        return this.roundRobinSelection(healthyTargets, routeKey);
    }
  }

  /**
   * Increment connection count for target
   */
  incrementConnectionCount(targetUrl: string): void {
    const current = this.connectionCounts.get(targetUrl) || 0;
    this.connectionCounts.set(targetUrl, current + 1);
  }

  /**
   * Decrement connection count for target
   */
  decrementConnectionCount(targetUrl: string): void {
    const current = this.connectionCounts.get(targetUrl) || 0;
    this.connectionCounts.set(targetUrl, Math.max(0, current - 1));
  }

  /**
   * Get connection count for target
   */
  getConnectionCount(targetUrl: string): number {
    return this.connectionCounts.get(targetUrl) || 0;
  }

  /**
   * Round-robin selection
   */
  private roundRobinSelection(targets: RouteTarget[], routeKey: string): RouteTarget {
    const counter = this.roundRobinCounters.get(routeKey) || 0;
    const selectedIndex = counter % targets.length;
    
    this.roundRobinCounters.set(routeKey, counter + 1);
    
    return targets[selectedIndex]!;
  }

  /**
   * Weighted round-robin selection
   */
  private weightedRoundRobinSelection(targets: RouteTarget[], routeKey: string): RouteTarget {
    const totalWeight = targets.reduce((sum, target) => sum + target.weight, 0);
    const counter = this.roundRobinCounters.get(routeKey) || 0;
    
    let weightedIndex = (counter % totalWeight) + 1;
    this.roundRobinCounters.set(routeKey, counter + 1);

    for (const target of targets) {
      weightedIndex -= target.weight;
      if (weightedIndex <= 0) {
        return target;
      }
    }

    // Fallback to first target
    return targets[0]!;
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelection(targets: RouteTarget[]): RouteTarget {
    let selectedTarget = targets[0]!;
    let minConnections = this.getConnectionCount(selectedTarget.url);

    for (const target of targets.slice(1)) {
      const connections = this.getConnectionCount(target.url);
      if (connections < minConnections) {
        minConnections = connections;
        selectedTarget = target;
      }
    }

    return selectedTarget;
  }

  /**
   * Least response time selection
   */
  private leastResponseTimeSelection(targets: RouteTarget[]): RouteTarget {
    return targets.reduce((best, current) => 
      current.responseTime < best.responseTime ? current : best
    );
  }

  /**
   * Health-based selection (prioritize healthiest targets)
   */
  private healthBasedSelection(targets: RouteTarget[]): RouteTarget {
    // Sort by health score (lower error count = healthier)
    const sortedTargets = targets
      .slice()
      .sort((a, b) => a.errorCount - b.errorCount);

    return sortedTargets[0]!;
  }

  /**
   * Random selection
   */
  private randomSelection(targets: RouteTarget[]): RouteTarget {
    const randomIndex = Math.floor(Math.random() * targets.length);
    return targets[randomIndex]!;
  }

  /**
   * Get load balancer statistics
   */
  getStats() {
    return {
      roundRobinCounters: Object.fromEntries(this.roundRobinCounters),
      connectionCounts: Object.fromEntries(this.connectionCounts),
      totalRoutes: this.roundRobinCounters.size,
      totalConnections: Array.from(this.connectionCounts.values()).reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.roundRobinCounters.clear();
    this.connectionCounts.clear();
    this.logger.log('Load balancer statistics reset');
  }
}